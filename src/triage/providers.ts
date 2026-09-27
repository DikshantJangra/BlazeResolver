/**
 * Every AI provider BlazeResolver can call for triage and fixes. Nothing needs naming: paste keys and it works out
 * which provider each one belongs to.
 *
 *   API_KEYS=sk-ant-...,gsk_...,nvapi-...     any mix of providers, comma-separated (or API_KEY, API_KEY_1, API_KEY_2, ...)
 *
 * How a key is identified, cheapest first:
 *   1. Its own variable name: ANTHROPIC_API_KEY, OPENAI_API_KEY, ... (plus common aliases like GOOGLE_API_KEY, HF_TOKEN).
 *      Each also takes {PREFIX}_API_KEYS (comma-separated) and {PREFIX}_API_KEY_1..N.
 *   2. Its format: most providers use a distinctive prefix (sk-ant-, gsk_, nvapi-, AIza, xai-, pplx-, hf_, ...).
 *   3. For the few formats that say nothing (Mistral, Together, Cohere, ...), with BLAZE_KEY_PROBE=on: on first use,
 *      the likely providers are asked whether the key is theirs (a model-list request, no tokens spent), and the answer
 *      is cached. Off by default, since that shows the key to providers it may not belong to; such keys are otherwise
 *      skipped with a warning and need a named variable (MISTRAL_API_KEY, ...) or BLAZE_PROVIDER.
 *
 * Every configured provider is used, in priority order, as automatic failover: a provider that errors is skipped for a
 * minute and the next one answers. Several keys for one provider rotate round-robin; a rate-limited key cools down.
 * BLAZE_PROVIDER pins a single provider. BLAZE_MODEL overrides the model on the providers that serve it (a Claude model
 * name never goes to Groq), and puts the provider that owns that model first.
 */

export type Complete = (system: string, user: string) => Promise<string>;

type Env = Record<string, string | undefined>;

export class ProviderError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'ProviderError';
  }
}

interface Tuning {
  maxTokens: number;
  timeoutMs: number;
}

interface CompleteOptions {
  apiKey?: string;
  maxTokens?: number;
  timeoutMs?: number;
  env?: Env;
}

const COOLDOWN_MS = 60_000;
const PROBE_TIMEOUT_MS = 5_000;
const NO_KEY = 'not-needed';

// ---- Failover ---------------------------------------------------------------------

type Retry = (err: unknown) => boolean;

/** Another key of the same provider can help with auth, rate-limit and server errors, not with a bad request. */
const keyRetry: Retry = (err) => err instanceof ProviderError && ([401, 403, 408, 429].includes(err.status) || err.status >= 500);
/** Another provider can help with anything: an outage, a bad model name, a timeout. */
const anyError: Retry = () => true;

/**
 * Tries `calls` until one answers. `rotate` round-robins the starting point (keys of one provider); otherwise the
 * order is a priority list (providers). Anything that failed with a retryable error sits out for a minute, unless
 * everything is sitting out.
 */
function failover(calls: Complete[], rotate: boolean, retry: Retry): Complete {
  if (calls.length === 1) return calls[0];
  const coolingUntil = calls.map(() => 0);
  let start = 0;
  return async (system, user) => {
    const order = calls.map((_, i) => (rotate ? (start + i) % calls.length : i));
    const now = Date.now();
    const ready = order.filter((i) => coolingUntil[i] <= now);
    let lastErr: unknown;
    for (const i of ready.length ? ready : order) {
      try {
        const out = await calls[i](system, user);
        if (rotate) start = (i + 1) % calls.length;
        return out;
      } catch (err) {
        if (!retry(err)) throw err;
        coolingUntil[i] = Date.now() + COOLDOWN_MS;
        lastErr = err;
      }
    }
    throw lastErr;
  };
}

/**
 * One `Complete` per key, round-robin, moving to the next key on an auth, rate-limit or server error.
 * A single key skips the wrapper so behavior (and errors) match calling that one function directly.
 */
export function withKeyRotation(keys: string[], build: (key: string) => Complete): Complete | undefined {
  return keys.length ? failover(keys.map(build), true, keyRetry) : undefined;
}

// ---- Wire formats -----------------------------------------------------------------

async function checked(res: Response, label: string): Promise<any> {
  if (!res.ok) throw new ProviderError(`${label} ${res.status}`, res.status);
  return res.json();
}

function anthropicCall(key: string, model: string, t: Tuning): Complete {
  return async (system, user) => {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model, max_tokens: t.maxTokens, system, messages: [{ role: 'user', content: user }] }),
      signal: AbortSignal.timeout(t.timeoutMs)
    });
    const body = (await checked(res, 'anthropic')) as { content: { text?: string }[] };
    return body.content.map((c) => c.text ?? '').join('');
  };
}

function geminiCall(key: string, model: string, t: Tuning): Complete {
  return async (system, user) => {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig: { maxOutputTokens: t.maxTokens }
      }),
      signal: AbortSignal.timeout(t.timeoutMs)
    });
    const body = (await checked(res, 'gemini')) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    return body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
  };
}

/** OpenAI's /chat/completions, which most providers speak. `headers` carries the auth. */
function chatCall(url: string, headers: Record<string, string>, model: string | undefined, t: Tuning, label: string): Complete {
  return async (system, user) => {
    const res = await fetch(url, {
      method: 'POST',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({
        ...(model ? { model } : {}),
        max_tokens: t.maxTokens,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ]
      }),
      signal: AbortSignal.timeout(t.timeoutMs)
    });
    const body = (await checked(res, label)) as { choices?: { message?: { content?: string | null } }[] };
    return body.choices?.[0]?.message?.content ?? '';
  };
}

// ---- Providers --------------------------------------------------------------------

interface ProviderDef {
  name: string;
  envPrefix: string;
  /** Other variable names people already use for this provider's key. */
  aliases?: string[];
  /** Recognizes this provider's keys from their format alone. */
  keyFormat?: RegExp;
  /** Where to ask whether an unrecognizable key is this provider's (GET, Bearer). `skOnly`: only for sk- keys. */
  probe?: { url: (env: Env) => string; skOnly?: boolean };
  /** Models this provider serves under their bare names. */
  serves?: RegExp;
  /** Serves only its own models, so a BLAZE_MODEL naming anything else isn't sent to it. */
  vendorOnly?: boolean;
  modelEnv: string;
  defaultModel: string;
  /** Config beyond a key that must be present (Azure's endpoint and deployment). */
  needs?: (env: Env) => boolean;
  /** Takes no key (a local Ollama); auto-selected only when this returns true. */
  keyless?: (env: Env) => boolean;
  call: (key: string, model: string, t: Tuning, env: Env) => Complete;
}

/** A provider that speaks OpenAI's /chat/completions at `baseUrl` (overridable with `baseUrlEnv`). */
function compat(
  def: Omit<ProviderDef, 'call' | 'probe'> & { baseUrl: string; baseUrlEnv?: string; probe?: boolean | 'sk' }
): ProviderDef {
  const base = (env: Env) => ((def.baseUrlEnv && env[def.baseUrlEnv]) || def.baseUrl).replace(/\/$/, '');
  return {
    ...def,
    probe: def.probe ? { url: (env) => `${base(env)}/models`, skOnly: def.probe === 'sk' } : undefined,
    call: (key, model, t, env) => chatCall(`${base(env)}/chat/completions`, { authorization: `Bearer ${key}` }, model, t, def.name)
  };
}

/** Names only their own vendors serve bare; open-model hosts never get these as BLAZE_MODEL. */
const PROPRIETARY = /^(claude|gemini|grok|gpt-|o\d|chatgpt|deepseek|qwen)/i;

/** In priority order: with several configured, the first answers and the rest are failover. */
const DEFS: ProviderDef[] = [
  {
    name: 'anthropic',
    envPrefix: 'ANTHROPIC',
    aliases: ['CLAUDE_API_KEY'],
    keyFormat: /^sk-ant-/,
    serves: /^claude/i,
    vendorOnly: true,
    modelEnv: 'ANTHROPIC_MODEL',
    defaultModel: 'claude-sonnet-5',
    call: (key, model, t) => anthropicCall(key, model, t)
  },
  compat({
    name: 'openai',
    envPrefix: 'OPENAI',
    // Project, service-account and admin keys say so; every OpenAI key embeds base64("OpenAI").
    keyFormat: /^sk-(proj|svcacct|admin)-|T3BlbkFJ/,
    probe: 'sk',
    serves: /^(gpt-|o\d|chatgpt|ft:)/i,
    vendorOnly: true,
    modelEnv: 'OPENAI_MODEL',
    defaultModel: 'gpt-4.1-mini',
    baseUrl: 'https://api.openai.com/v1',
    baseUrlEnv: 'OPENAI_BASE_URL'
  }),
  {
    name: 'azure-openai',
    envPrefix: 'AZURE_OPENAI',
    aliases: ['AZURE_API_KEY'],
    vendorOnly: true,
    modelEnv: 'AZURE_OPENAI_MODEL',
    defaultModel: '',
    needs: (env) => !!(env.AZURE_OPENAI_ENDPOINT && env.AZURE_OPENAI_DEPLOYMENT),
    call: (key, _model, t, env) =>
      chatCall(
        `${env.AZURE_OPENAI_ENDPOINT!.replace(/\/$/, '')}/openai/deployments/${env.AZURE_OPENAI_DEPLOYMENT}/chat/completions?api-version=${env.AZURE_OPENAI_API_VERSION || '2024-08-01-preview'}`,
        { 'api-key': key },
        undefined,
        t,
        'azure-openai'
      )
  },
  {
    name: 'gemini',
    envPrefix: 'GEMINI',
    aliases: ['GOOGLE_API_KEY', 'GOOGLE_GENERATIVE_AI_API_KEY'],
    keyFormat: /^AIza[\w-]{30,}$/,
    serves: /^(gemini|gemma)/i,
    vendorOnly: true,
    modelEnv: 'GEMINI_MODEL',
    defaultModel: 'gemini-2.0-flash',
    call: (key, model, t) => geminiCall(key, model, t)
  },
  compat({ name: 'xai', envPrefix: 'XAI', keyFormat: /^xai-/, serves: /^grok/i, vendorOnly: true, modelEnv: 'XAI_MODEL', defaultModel: 'grok-2-latest', baseUrl: 'https://api.x.ai/v1' }),
  compat({
    name: 'mistral',
    envPrefix: 'MISTRAL',
    probe: true,
    serves: /^(mistral|codestral|ministral|magistral|pixtral|devstral|open-mi[sx]tral)/i,
    vendorOnly: true,
    modelEnv: 'MISTRAL_MODEL',
    defaultModel: 'mistral-large-latest',
    baseUrl: 'https://api.mistral.ai/v1'
  }),
  compat({
    name: 'deepseek',
    envPrefix: 'DEEPSEEK',
    aliases: ['DEEPSEEK_API_KEY'],
    keyFormat: /^sk-[0-9a-f]{32}$/,
    probe: 'sk',
    serves: /^deepseek/i,
    vendorOnly: true,
    modelEnv: 'DEEPSEEK_MODEL',
    defaultModel: 'deepseek-chat',
    baseUrl: 'https://api.deepseek.com',
    baseUrlEnv: 'DEEPSEEK_BASE_URL'
  }),
  compat({
    name: 'qwen',
    envPrefix: 'QWEN',
    aliases: ['DASHSCOPE_API_KEY', 'QWEN_API_KEY', 'ALIBABA_API_KEY'],
    probe: 'sk',
    serves: /^qwen/i,
    vendorOnly: true,
    modelEnv: 'QWEN_MODEL',
    defaultModel: 'qwen-plus',
    baseUrl: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
    baseUrlEnv: 'QWEN_BASE_URL'
  }),
  compat({ name: 'groq', envPrefix: 'GROQ', keyFormat: /^gsk_/, modelEnv: 'GROQ_MODEL', defaultModel: 'openai/gpt-oss-120b', baseUrl: 'https://api.groq.com/openai/v1' }),
  compat({
    name: 'nvidia',
    envPrefix: 'NVIDIA',
    aliases: ['NVIDIA_NIM_API_KEY', 'NGC_API_KEY'],
    keyFormat: /^nvapi-/,
    modelEnv: 'NVIDIA_MODEL',
    defaultModel: 'meta/llama-3.1-70b-instruct',
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    baseUrlEnv: 'NVIDIA_BASE_URL'
  }),
  compat({ name: 'cerebras', envPrefix: 'CEREBRAS', keyFormat: /^csk-/, modelEnv: 'CEREBRAS_MODEL', defaultModel: 'llama3.1-70b', baseUrl: 'https://api.cerebras.ai/v1' }),
  compat({
    name: 'fireworks',
    envPrefix: 'FIREWORKS',
    keyFormat: /^fw_/,
    modelEnv: 'FIREWORKS_MODEL',
    defaultModel: 'accounts/fireworks/models/llama-v3p1-70b-instruct',
    baseUrl: 'https://api.fireworks.ai/inference/v1'
  }),
  compat({
    name: 'together',
    envPrefix: 'TOGETHER',
    probe: true,
    modelEnv: 'TOGETHER_MODEL',
    defaultModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    baseUrl: 'https://api.together.xyz/v1'
  }),
  compat({
    name: 'deepinfra',
    envPrefix: 'DEEPINFRA',
    probe: true,
    modelEnv: 'DEEPINFRA_MODEL',
    defaultModel: 'meta-llama/Meta-Llama-3.1-70B-Instruct',
    baseUrl: 'https://api.deepinfra.com/v1/openai'
  }),
  compat({ name: 'sambanova', envPrefix: 'SAMBANOVA', probe: true, modelEnv: 'SAMBANOVA_MODEL', defaultModel: 'Meta-Llama-3.1-70B-Instruct', baseUrl: 'https://api.sambanova.ai/v1' }),
  compat({
    name: 'hyperbolic',
    envPrefix: 'HYPERBOLIC',
    probe: true,
    modelEnv: 'HYPERBOLIC_MODEL',
    defaultModel: 'meta-llama/Meta-Llama-3.1-70B-Instruct',
    baseUrl: 'https://api.hyperbolic.xyz/v1'
  }),
  compat({ name: 'novita', envPrefix: 'NOVITA', probe: true, modelEnv: 'NOVITA_MODEL', defaultModel: 'meta-llama/llama-3.1-70b-instruct', baseUrl: 'https://api.novita.ai/v3/openai' }),
  compat({
    name: 'moonshot',
    envPrefix: 'MOONSHOT',
    aliases: ['KIMI_API_KEY'],
    probe: 'sk',
    serves: /^(moonshot|kimi)/i,
    vendorOnly: true,
    modelEnv: 'MOONSHOT_MODEL',
    defaultModel: 'moonshot-v1-8k',
    baseUrl: 'https://api.moonshot.ai/v1'
  }),
  compat({
    name: 'zhipu',
    envPrefix: 'ZHIPU',
    aliases: ['ZHIPUAI_API_KEY', 'ZAI_API_KEY'],
    keyFormat: /^[0-9a-f]{32}\.[0-9A-Za-z]{16}$/,
    serves: /^glm/i,
    vendorOnly: true,
    modelEnv: 'ZHIPU_MODEL',
    defaultModel: 'glm-4-plus',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4'
  }),
  {
    ...compat({
      name: 'cohere',
      envPrefix: 'COHERE',
      aliases: ['CO_API_KEY'],
      serves: /^(command|c4ai)/i,
      vendorOnly: true,
      modelEnv: 'COHERE_MODEL',
      defaultModel: 'command-r-plus',
      baseUrl: 'https://api.cohere.ai/compatibility/v1'
    }),
    probe: { url: () => 'https://api.cohere.com/v1/models' }
  },
  compat({ name: 'ai21', envPrefix: 'AI21', serves: /^jamba/i, vendorOnly: true, modelEnv: 'AI21_MODEL', defaultModel: 'jamba-large', baseUrl: 'https://api.ai21.com/studio/v1' }),
  compat({ name: 'baseten', envPrefix: 'BASETEN', modelEnv: 'BASETEN_MODEL', defaultModel: 'meta-llama/Llama-3.3-70B-Instruct', baseUrl: 'https://inference.baseten.co/v1' }),
  compat({
    name: 'perplexity',
    envPrefix: 'PERPLEXITY',
    keyFormat: /^pplx-/,
    serves: /^(sonar|r1-1776)/i,
    vendorOnly: true,
    modelEnv: 'PERPLEXITY_MODEL',
    defaultModel: 'sonar',
    baseUrl: 'https://api.perplexity.ai'
  }),
  // A GitHub token pasted as a universal key means GitHub Models. BLAZE_GITHUB_TOKEN / GITHUB_TOKEN are never used:
  // they stay scoped to issues and pull requests.
  compat({
    name: 'github-models',
    envPrefix: 'GITHUB_MODELS',
    keyFormat: /^(ghp_|github_pat_|gho_|ghu_)/,
    serves: /^(gpt-|o\d)/i,
    modelEnv: 'GITHUB_MODELS_MODEL',
    defaultModel: 'gpt-4o-mini',
    baseUrl: 'https://models.inference.ai.azure.com'
  }),
  compat({
    name: 'huggingface',
    envPrefix: 'HUGGINGFACE',
    aliases: ['HF_TOKEN', 'HUGGINGFACEHUB_API_TOKEN'],
    keyFormat: /^hf_/,
    modelEnv: 'HUGGINGFACE_MODEL',
    defaultModel: 'meta-llama/Llama-3.3-70B-Instruct',
    baseUrl: 'https://router.huggingface.co/v1'
  }),
  compat({ name: 'openrouter', envPrefix: 'OPENROUTER', keyFormat: /^sk-or-/, modelEnv: 'OPENROUTER_MODEL', defaultModel: 'openrouter/auto', baseUrl: 'https://openrouter.ai/api/v1' }),
  compat({
    name: 'ollama',
    envPrefix: 'OLLAMA',
    keyless: (env) => !!(env.OLLAMA_BASE_URL || env.OLLAMA_MODEL),
    modelEnv: 'OLLAMA_MODEL',
    defaultModel: 'llama3.1',
    baseUrl: 'http://localhost:11434/v1',
    baseUrlEnv: 'OLLAMA_BASE_URL'
  })
];

const BY_NAME = new Map(DEFS.map((d) => [d.name, d]));

/** Every provider BlazeResolver knows, in priority order. */
export function listProviders(): { name: string; envPrefix: string }[] {
  return DEFS.map(({ name, envPrefix }) => ({ name, envPrefix }));
}

/** The provider a key belongs to, judging by its format alone; undefined when the format says nothing. */
export function identifyKey(key: string): string | undefined {
  return DEFS.find((d) => d.keyFormat?.test(key))?.name;
}

// ---- Keys & models ----------------------------------------------------------------

function splitCsv(value: string | undefined): string[] {
  return value ? value.split(',').map((v) => v.trim()).filter(Boolean) : [];
}

function collect(env: Env, csvName: string, singleBase: string): string[] {
  const out = splitCsv(env[csvName]);
  for (let i = 1; ; i++) {
    const v = env[`${singleBase}_${i}`]?.trim();
    if (!v) break;
    out.push(v);
  }
  const single = env[singleBase]?.trim();
  if (single) out.push(single);
  return out;
}

const universalKeys = (env: Env) => [...new Set(collect(env, 'API_KEYS', 'API_KEY'))];

function namedKeys(def: ProviderDef, env: Env): string[] {
  const aliases = (def.aliases ?? []).map((a) => env[a]?.trim()).filter((v): v is string => !!v);
  return [...collect(env, `${def.envPrefix}_API_KEYS`, `${def.envPrefix}_API_KEY`), ...aliases];
}

/**
 * Keys for one provider: its own variables, plus universal keys that are its format or whose format says nothing.
 * Universal keys recognizably belonging to another provider are never sent to this one.
 */
export function resolveApiKeys(prefix: string, env: Env = process.env): string[] {
  const def = DEFS.find((d) => d.envPrefix === prefix);
  const own = def ? namedKeys(def, env) : collect(env, `${prefix}_API_KEYS`, `${prefix}_API_KEY`);
  const universal = universalKeys(env).filter((k) => {
    const owner = identifyKey(k);
    return !owner || owner === def?.name;
  });
  return [...new Set([...own, ...universal])];
}

/**
 * Keys that certainly belong to one provider: its own variables, plus universal keys whose format says they're its.
 * Unlike resolveApiKeys, a universal key of unknown format is never included, so no key is sent anywhere on a guess.
 */
export function providerKeys(name: string, env: Env = process.env): string[] {
  const def = BY_NAME.get(name);
  if (!def) return [];
  return [...new Set([...namedKeys(def, env), ...universalKeys(env).filter((k) => identifyKey(k) === name)])];
}

function acceptsModel(def: ProviderDef, model: string, forced: boolean): boolean {
  if (forced || def.serves?.test(model)) return true;
  return !def.vendorOnly && !PROPRIETARY.test(model);
}

function modelFor(def: ProviderDef, env: Env, forced: boolean): string {
  const blaze = env.BLAZE_MODEL?.trim();
  return env[def.modelEnv] || (blaze && acceptsModel(def, blaze, forced) ? blaze : def.defaultModel);
}

function providerCall(def: ProviderDef, keys: string[], t: Tuning, env: Env, forced: boolean): Complete {
  const model = modelFor(def, env, forced);
  return withKeyRotation(keys, (key) => def.call(key, model, t, env))!;
}

// ---- Probing keys whose format says nothing -------------------------------------------

/** key -> provider name, or null when every candidate said no. Network failures aren't cached. */
const probeCache = new Map<string, string | null>();
const warned = new Set<string>();

function warnOnce(message: string) {
  if (warned.has(message)) return;
  warned.add(message);
  console.warn(message);
}

const mask = (key: string) => (key.length <= 10 ? '•••' : `${key.slice(0, 4)}…${key.slice(-4)}`);

async function probeKey(key: string, env: Env): Promise<ProviderDef | undefined> {
  const cached = probeCache.get(key);
  if (cached !== undefined) return cached === null ? undefined : BY_NAME.get(cached);
  let inconclusive = false;
  for (const def of DEFS) {
    if (!def.probe || (def.probe.skOnly && !key.startsWith('sk-'))) continue;
    try {
      const res = await fetch(def.probe.url(env), { headers: { authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) });
      await res.body?.cancel().catch(() => {});
      if (res.ok) {
        probeCache.set(key, def.name);
        return def;
      }
      if (res.status === 429 || res.status >= 500) inconclusive = true;
    } catch {
      inconclusive = true;
    }
  }
  if (!inconclusive) {
    probeCache.set(key, null);
    warnOnce(`BlazeResolver: no provider recognized the API key ${mask(key)}; set BLAZE_PROVIDER or use a named variable such as AI21_API_KEY.`);
  }
  return undefined;
}

/** A provider slot for keys that need probing: identifies them on the first call, then behaves like any other. */
function probedCall(keys: string[], t: Tuning, env: Env): Complete {
  let pending: Promise<Complete | undefined> | undefined;
  return async (system, user) => {
    pending ??= (async () => {
      const calls: Complete[] = [];
      for (const key of keys) {
        const def = await probeKey(key, env);
        if (def) calls.push(providerCall(def, [key], t, env, false));
      }
      return calls.length ? failover(calls, true, keyRetry) : undefined;
    })();
    const complete = await pending;
    if (!complete) {
      pending = undefined;
      throw new ProviderError('could not identify the provider of the configured API key(s)', 401);
    }
    return complete(system, user);
  };
}

// ---- Planning -----------------------------------------------------------------------

interface Slot {
  def: ProviderDef;
  keys: string[];
  /** Why each key went to this provider, for describeProviders. */
  via: string[];
}

interface Plan {
  slots: Slot[];
  /** Universal keys whose format says nothing; probed on first use. */
  unknown: string[];
  forced?: ProviderDef;
  badForced?: string;
}

function plan(env: Env): Plan {
  const forcedName = env.BLAZE_PROVIDER?.trim().toLowerCase();
  if (forcedName) {
    const def = BY_NAME.get(forcedName);
    if (!def) return { slots: [], unknown: [], badForced: forcedName };
    if (def.needs && !def.needs(env)) return { slots: [], unknown: [], forced: def };
    const keys = resolveApiKeys(def.envPrefix, env);
    if (!keys.length && !def.keyless) return { slots: [], unknown: [], forced: def };
    const final = keys.length ? keys : [NO_KEY];
    return { slots: [{ def, keys: final, via: final.map(() => 'BLAZE_PROVIDER') }], unknown: [], forced: def };
  }

  const universal = universalKeys(env);
  let unknown = universal.filter((k) => !identifyKey(k));
  const slots: Slot[] = [];
  for (const def of DEFS) {
    if (def.needs && !def.needs(env)) continue;
    if (def.keyless) {
      if (def.keyless(env)) slots.push({ def, keys: [NO_KEY], via: ['local server'] });
      continue;
    }
    const keys = new Map<string, string>();
    for (const k of namedKeys(def, env)) keys.set(k, 'its own variable');
    for (const k of universal) if (identifyKey(k) === def.name && !keys.has(k)) keys.set(k, 'key format');
    // Azure keys have no telling format; with an Azure endpoint configured, an unrecognizable key is Azure's.
    if (def.name === 'azure-openai') {
      for (const k of unknown) if (!keys.has(k)) keys.set(k, 'Azure endpoint is set');
      unknown = [];
    }
    if (keys.size) slots.push({ def, keys: [...keys.keys()], via: [...keys.values()] });
  }

  const model = env.BLAZE_MODEL?.trim();
  const owner = model ? slots.findIndex((s) => s.def.serves?.test(model)) : -1;
  if (owner > 0) slots.unshift(...slots.splice(owner, 1));
  return { slots, unknown };
}

/** Off by default: probing shows a key to providers it may not belong to. */
const probingOn = (env: Env) => ['on', 'true', '1'].includes((env.BLAZE_KEY_PROBE ?? '').trim().toLowerCase());

function build(env: Env, t: Tuning): Complete | undefined {
  const p = plan(env);
  if (p.badForced) {
    console.warn(`BLAZE_PROVIDER="${p.badForced}" is not a known provider (${DEFS.map((d) => d.name).join(', ')}); ignoring it.`);
    return undefined;
  }
  const forced = !!p.forced;
  const calls = p.slots.filter((s) => !s.def.keyless).map((s) => providerCall(s.def, s.keys, t, env, forced));
  if (p.unknown.length) {
    if (probingOn(env)) calls.push(probedCall(p.unknown, t, env));
    else
      warnOnce(
        `BlazeResolver: skipping ${p.unknown.map(mask).join(', ')}: its provider can't be told from the key. ` +
          'Put it in a named variable (e.g. MISTRAL_API_KEY), set BLAZE_PROVIDER, or set BLAZE_KEY_PROBE=on to identify it automatically.'
      );
  }
  calls.push(...p.slots.filter((s) => s.def.keyless).map((s) => providerCall(s.def, s.keys, t, env, forced)));
  return calls.length ? failover(calls, false, anyError) : undefined;
}

// ---- Public entry points --------------------------------------------------------------

const RELEVANT = /^(API_KEYS?|API_KEY_\d+|BLAZE_PROVIDER|BLAZE_MODEL|BLAZE_KEY_PROBE)$|_(API_KEYS?|API_KEY_\d+|MODEL|BASE_URL)$|^AZURE_OPENAI_/;
const ALIASES = new Set(DEFS.flatMap((d) => d.aliases ?? []));
/** Built once per configuration, so failover cooldowns and probe results carry across requests. */
const built = new Map<string, Complete | undefined>();

/**
 * The model behind triage and fixes, from whatever keys are configured — no provider needs naming (see the top of
 * this file). Returns undefined when there are none; callers then fall back to rules.
 */
export function resolveComplete(opts: CompleteOptions = {}): Complete | undefined {
  const env = opts.env ?? process.env;
  const t = { maxTokens: opts.maxTokens ?? 600, timeoutMs: opts.timeoutMs ?? 20_000 };
  const signature = JSON.stringify([
    t,
    Object.keys(env)
      .filter((k) => RELEVANT.test(k) || ALIASES.has(k))
      .sort()
      .map((k) => [k, env[k]])
  ]);
  if (!built.has(signature)) built.set(signature, build(env, t));
  return built.get(signature);
}

/** What resolveComplete would use, in order, with keys masked. For startup logs and `blazeresolver providers`. */
export function describeProviders(env: Env = process.env): string[] {
  const p = plan(env);
  if (p.badForced) return [`BLAZE_PROVIDER="${p.badForced}" is not a known provider`];
  const line = (s: Slot) => `${s.def.name}: ${s.keys.map((k, i) => (k === NO_KEY ? 'no key needed' : `${mask(k)} (${s.via[i]})`)).join(', ')}`;
  const lines = p.slots.filter((s) => !s.def.keyless).map(line);
  if (p.unknown.length) {
    lines.push(
      probingOn(env)
        ? `identified on first use: ${p.unknown.map((k) => (probeCache.get(k) ? `${mask(k)} -> ${probeCache.get(k)}` : mask(k))).join(', ')}`
        : `skipped, provider unknown (use a named variable like MISTRAL_API_KEY, or BLAZE_KEY_PROBE=on): ${p.unknown.map(mask).join(', ')}`
    );
  }
  lines.push(...p.slots.filter((s) => s.def.keyless).map(line));
  return lines;
}

/** One provider's `Complete`, for callers that want that provider specifically. */
function single(name: string) {
  const def = BY_NAME.get(name)!;
  return ({ apiKey, maxTokens = 600, timeoutMs = 20_000, env = process.env }: CompleteOptions = {}): Complete | undefined => {
    if (def.needs && !def.needs(env)) return undefined;
    const keys = apiKey ? [apiKey] : resolveApiKeys(def.envPrefix, env);
    if (!keys.length && !def.keyless) return undefined;
    return providerCall(def, keys.length ? keys : [NO_KEY], { maxTokens, timeoutMs }, env, false);
  };
}

export const anthropicComplete = single('anthropic');
export const openaiComplete = single('openai');
export const azureOpenAIComplete = single('azure-openai');
export const geminiComplete = single('gemini');
export const xaiComplete = single('xai');
export const mistralComplete = single('mistral');
export const deepseekComplete = single('deepseek');
export const qwenComplete = single('qwen');
export const groqComplete = single('groq');
export const nvidiaComplete = single('nvidia');
export const cerebrasComplete = single('cerebras');
export const fireworksComplete = single('fireworks');
export const togetherComplete = single('together');
export const deepinfraComplete = single('deepinfra');
export const sambanovaComplete = single('sambanova');
export const hyperbolicComplete = single('hyperbolic');
export const novitaComplete = single('novita');
export const moonshotComplete = single('moonshot');
export const zhipuComplete = single('zhipu');
export const cohereComplete = single('cohere');
export const ai21Complete = single('ai21');
export const basetenComplete = single('baseten');
export const perplexityComplete = single('perplexity');
export const githubModelsComplete = single('github-models');
export const huggingfaceComplete = single('huggingface');
export const openrouterComplete = single('openrouter');
export const ollamaComplete = single('ollama');
