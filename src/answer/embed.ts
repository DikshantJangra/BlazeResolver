/**
 * Embeddings for semantic search over help docs, so "delete my account" finds a section that only says "close".
 * Found from the same keys as the AI providers; nothing to set up when one of them offers embeddings.
 *
 *   OpenAI, Voyage, Gemini, Mistral, Cohere, NVIDIA NIM, Azure OpenAI (with AZURE_OPENAI_EMBEDDING_DEPLOYMENT), a local Ollama,
 *   or any OpenAI-compatible endpoint (BLAZE_EMBED_BASE_URL, with BLAZE_EMBED_API_KEY and BLAZE_EMBED_MODEL).
 *
 * One provider is picked, the first configured in that order, and never swapped for another: vectors from different
 * models can't be compared. Several keys for it are tried in turn. BLAZE_EMBED_PROVIDER pins one (or `off`),
 * BLAZE_EMBED_MODEL overrides its model. Anthropic, Groq and most chat-only hosts have no embeddings; with only those,
 * search stays keyword-only.
 */
import { ProviderError, providerKeys } from '../triage/providers.js';

type Env = Record<string, string | undefined>;

/** A question is embedded as a query, doc sections as documents; some models encode the two differently. */
export type EmbedKind = 'document' | 'query';

export interface Embedder {
  /** Provider and model. Vectors are only ever compared with vectors of the same id. */
  id: string;
  embed(texts: string[], kind: EmbedKind): Promise<number[][]>;
}

export interface EmbedOptions {
  env?: Env;
  timeoutMs?: number;
  fetch?: typeof fetch;
}

type Call = (texts: string[], kind: EmbedKind) => Promise<number[][]>;

interface EmbedDef {
  name: string;
  defaultModel: string;
  /** Most texts one request takes. */
  batch: number;
  keys: (env: Env) => string[];
  /** Config beyond a key that must be present. */
  needs?: (env: Env) => boolean;
  call: (key: string, model: string, env: Env, t: { timeoutMs: number; f: typeof fetch }) => Call;
}

const NO_KEY = 'not-needed';
const trimSlash = (url: string) => url.replace(/\/$/, '');

async function post(f: typeof fetch, url: string, headers: Record<string, string>, body: unknown, timeoutMs: number, label: string): Promise<any> {
  const res = await f(url, {
    method: 'POST',
    headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs)
  });
  if (!res.ok) throw new ProviderError(`${label} embeddings ${res.status}`, res.status);
  return res.json();
}

/** OpenAI's /embeddings, which most hosts speak. `extra` adds provider fields to the body. */
function openaiStyle(url: string, headers: Record<string, string>, model: string | undefined, t: { timeoutMs: number; f: typeof fetch }, label: string, extra?: (kind: EmbedKind) => object): Call {
  return async (texts, kind) => {
    const body = (await post(t.f, url, headers, { ...(model ? { model } : {}), input: texts, ...extra?.(kind) }, t.timeoutMs, label)) as {
      data?: { embedding: number[]; index?: number }[];
    };
    const data = [...(body.data ?? [])].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
    return data.map((d) => d.embedding);
  };
}

const named = (...vars: string[]) => (env: Env) => vars.flatMap((v) => (env[v] ?? '').split(',')).map((k) => k.trim()).filter(Boolean);

/** In priority order. */
const DEFS: EmbedDef[] = [
  {
    name: 'custom',
    defaultModel: '',
    batch: 64,
    keys: (env) => (env.BLAZE_EMBED_API_KEY ? [env.BLAZE_EMBED_API_KEY] : [NO_KEY]),
    needs: (env) => !!env.BLAZE_EMBED_BASE_URL,
    call: (key, model, env, t) =>
      openaiStyle(`${trimSlash(env.BLAZE_EMBED_BASE_URL!)}/embeddings`, key === NO_KEY ? {} : { authorization: `Bearer ${key}` }, model || undefined, t, 'custom')
  },
  {
    name: 'openai',
    defaultModel: 'text-embedding-3-small',
    batch: 256,
    keys: (env) => providerKeys('openai', env),
    call: (key, model, env, t) =>
      openaiStyle(`${trimSlash(env.OPENAI_BASE_URL || 'https://api.openai.com/v1')}/embeddings`, { authorization: `Bearer ${key}` }, model, t, 'openai')
  },
  {
    name: 'voyage',
    defaultModel: 'voyage-3.5-lite',
    batch: 128,
    keys: named('VOYAGE_API_KEY', 'VOYAGE_API_KEYS'),
    call: (key, model, _env, t) =>
      openaiStyle('https://api.voyageai.com/v1/embeddings', { authorization: `Bearer ${key}` }, model, t, 'voyage', (kind) => ({ input_type: kind }))
  },
  {
    name: 'gemini',
    defaultModel: 'gemini-embedding-001',
    batch: 100,
    keys: (env) => providerKeys('gemini', env),
    call: (key, model, _env, t) => async (texts, kind) => {
      const body = (await post(
        t.f,
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:batchEmbedContents`,
        { 'x-goog-api-key': key },
        {
          requests: texts.map((text) => ({
            model: `models/${model}`,
            content: { parts: [{ text }] },
            taskType: kind === 'query' ? 'RETRIEVAL_QUERY' : 'RETRIEVAL_DOCUMENT',
            outputDimensionality: 768
          }))
        },
        t.timeoutMs,
        'gemini'
      )) as { embeddings?: { values: number[] }[] };
      return (body.embeddings ?? []).map((e) => e.values);
    }
  },
  {
    name: 'mistral',
    defaultModel: 'mistral-embed',
    batch: 64,
    keys: (env) => providerKeys('mistral', env),
    call: (key, model, _env, t) => openaiStyle('https://api.mistral.ai/v1/embeddings', { authorization: `Bearer ${key}` }, model, t, 'mistral')
  },
  {
    name: 'cohere',
    defaultModel: 'embed-v4.0',
    batch: 96,
    keys: (env) => providerKeys('cohere', env),
    call: (key, model, _env, t) => async (texts, kind) => {
      const body = (await post(
        t.f,
        'https://api.cohere.com/v2/embed',
        { authorization: `Bearer ${key}` },
        { model, texts, input_type: kind === 'query' ? 'search_query' : 'search_document', embedding_types: ['float'] },
        t.timeoutMs,
        'cohere'
      )) as { embeddings?: { float?: number[][] } };
      return body.embeddings?.float ?? [];
    }
  },
  {
    name: 'nvidia',
    defaultModel: 'nvidia/nemotron-3-embed-1b',
    batch: 50,
    keys: (env) => providerKeys('nvidia', env),
    call: (key, model, env, t) =>
      openaiStyle(
        `${trimSlash(env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1')}/embeddings`,
        { authorization: `Bearer ${key}` },
        model,
        t,
        'nvidia',
        // NIM retrieval models encode questions and passages differently, and cut text past their token limit.
        (kind) => ({ input_type: kind === 'query' ? 'query' : 'passage', encoding_format: 'float', truncate: 'END' })
      )
  },
  {
    name: 'azure-openai',
    defaultModel: '',
    batch: 256,
    keys: (env) => providerKeys('azure-openai', env),
    needs: (env) => !!(env.AZURE_OPENAI_ENDPOINT && env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT),
    call: (key, _model, env, t) =>
      openaiStyle(
        `${trimSlash(env.AZURE_OPENAI_ENDPOINT!)}/openai/deployments/${env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT}/embeddings?api-version=${env.AZURE_OPENAI_API_VERSION || '2024-08-01-preview'}`,
        { 'api-key': key },
        undefined,
        t,
        'azure-openai'
      )
  },
  {
    name: 'ollama',
    defaultModel: 'nomic-embed-text',
    batch: 64,
    keys: () => [NO_KEY],
    needs: (env) => !!(env.OLLAMA_BASE_URL || env.OLLAMA_EMBED_MODEL),
    call: (_key, model, env, t) => openaiStyle(`${trimSlash(env.OLLAMA_BASE_URL || 'http://localhost:11434/v1')}/embeddings`, {}, model, t, 'ollama')
  }
];

/** Every provider embeddings can come from, in priority order. */
export function listEmbedProviders(): string[] {
  return DEFS.map((d) => d.name);
}

/** Tries each key in turn, starting after the last one that worked, and checks one vector came back per text. */
function withKeys(calls: Call[], batch: number): Call {
  let start = 0;
  const once: Call = async (texts, kind) => {
    let lastErr: unknown;
    for (let n = 0; n < calls.length; n++) {
      const i = (start + n) % calls.length;
      try {
        const vectors = await calls[i](texts, kind);
        if (vectors.length !== texts.length || vectors.some((v) => !Array.isArray(v) || !v.length)) {
          throw new Error(`expected ${texts.length} embeddings, got ${vectors.length}`);
        }
        start = i;
        return vectors;
      } catch (err) {
        lastErr = err;
        // A bad request fails the same way with every key.
        if (err instanceof ProviderError && err.status === 400) break;
      }
    }
    throw lastErr;
  };
  return async (texts, kind) => {
    const out: number[][] = [];
    for (let i = 0; i < texts.length; i += batch) out.push(...(await once(texts.slice(i, i + batch), kind)));
    return out;
  };
}

const OFF = /^(off|none|false|0)$/i;

/** The embedder the environment configures, or undefined when none is (search then stays keyword-only). */
export function resolveEmbedder(opts: EmbedOptions = {}): Embedder | undefined {
  const env = opts.env ?? (globalThis as any).process?.env ?? {};
  const t = { timeoutMs: opts.timeoutMs ?? 10_000, f: opts.fetch ?? fetch };
  const pinned = env.BLAZE_EMBED_PROVIDER?.trim();
  if (pinned && OFF.test(pinned)) return undefined;

  const candidates = pinned ? DEFS.filter((d) => d.name === pinned.toLowerCase()) : DEFS;
  for (const def of candidates) {
    if (def.needs && !def.needs(env)) continue;
    const keys = def.keys(env);
    if (!keys.length) continue;
    const model = env.BLAZE_EMBED_MODEL?.trim() || (def.name === 'ollama' && env.OLLAMA_EMBED_MODEL?.trim()) || def.defaultModel;
    const embed = withKeys(
      keys.map((k) => def.call(k, model, env, t)),
      def.batch
    );
    const deployment = def.name === 'azure-openai' ? env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT : def.name === 'custom' ? env.BLAZE_EMBED_BASE_URL : '';
    return { id: `${def.name}:${model || deployment}`, embed };
  }
  return undefined;
}
