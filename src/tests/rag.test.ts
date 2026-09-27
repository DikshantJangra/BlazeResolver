import { describe, it } from 'node:test';
import assert from 'node:assert';
import { resolveEmbedder, type Embedder } from '../answer/embed.js';
import { retrieve, search } from '../answer/retrieve.js';
import { answerQuestion } from '../answer/index.js';
import { createSupportHandler, SupportStore } from '../support/index.js';
import type { Complete, Report, Triage } from '../triage/index.js';

const DOCS = `# Acme Notes

## Exporting

Open Settings, choose Export, and pick CSV or PDF.

## Closing your account

Go to Settings > Account and click Close account. Your notes are kept for 30 days.

## Sharing

Click Share on any note and enter your teammate's email address.
`;

/**
 * A stand-in for a real embeddings model: words about the same idea land on the same axis, so "remove my profile"
 * and "close your account" are alike even though they share no word. Records every text it embeds.
 */
function conceptEmbedder(id: string, opts: { fail?: boolean; delayMs?: number } = {}) {
  const concepts = [/delet|remov|clos|cancel|profil|account/g, /export|download|csv|pdf/g, /shar|invit|teammate/g];
  const embedded: { text: string; kind: string }[] = [];
  const embedder: Embedder = {
    id,
    async embed(texts, kind) {
      embedded.push(...texts.map((text) => ({ text, kind })));
      if (opts.delayMs) await new Promise((r) => setTimeout(r, opts.delayMs));
      if (opts.fail) throw new Error('embeddings 503');
      return texts.map((t) => [...concepts.map((re) => (t.toLowerCase().match(re) ?? []).length), 0.1]);
    }
  };
  return { embedder, embedded };
}

/** A fetch that records requests and answers each with `reply(url, body)`. */
function fakeFetch(reply: (url: string, body: any) => unknown, status = (_url: string) => 200) {
  const calls: { url: string; headers: Record<string, string>; body: any }[] = [];
  const f = (async (url: string, init: any) => {
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ url, headers: init.headers, body });
    const code = status(url);
    return new Response(JSON.stringify(code === 200 ? reply(url, body) : { error: 'x' }), { status: code });
  }) as unknown as typeof fetch;
  return { calls, f };
}

describe('embeddings providers', () => {
  it('uses OpenAI when its key is set, in batches, with vectors in input order', async () => {
    const api = fakeFetch((_url, body) => ({ data: body.input.map((_: string, i: number) => ({ index: i, embedding: [i + 1] })).reverse() }));
    const embedder = resolveEmbedder({ env: { OPENAI_API_KEY: 'sk-proj-abc' }, fetch: api.f })!;
    assert.equal(embedder.id, 'openai:text-embedding-3-small');
    const texts = Array.from({ length: 300 }, (_, i) => `t${i}`);
    const vectors = await embedder.embed(texts, 'document');
    assert.equal(vectors.length, 300);
    assert.deepEqual(vectors.slice(0, 3), [[1], [2], [3]]);
    assert.equal(api.calls.length, 2, '256 per request');
    assert.equal(api.calls[0].url, 'https://api.openai.com/v1/embeddings');
    assert.equal(api.calls[0].headers.authorization, 'Bearer sk-proj-abc');
    assert.equal(api.calls[0].body.model, 'text-embedding-3-small');
  });

  it('asks Gemini, Voyage and Cohere for query or document embeddings as each expects', async () => {
    const gemini = fakeFetch((_u, body) => ({ embeddings: body.requests.map(() => ({ values: [1] })) }));
    await resolveEmbedder({ env: { GEMINI_API_KEY: 'AIza' + 'x'.repeat(35) }, fetch: gemini.f })!.embed(['q'], 'query');
    assert.match(gemini.calls[0].url, /models\/gemini-embedding-001:batchEmbedContents$/);
    assert.equal(gemini.calls[0].body.requests[0].taskType, 'RETRIEVAL_QUERY');
    assert.ok(gemini.calls[0].headers['x-goog-api-key'].startsWith('AIza'));

    const voyage = fakeFetch((_u, body) => ({ data: body.input.map((_: string, index: number) => ({ index, embedding: [1] })) }));
    await resolveEmbedder({ env: { VOYAGE_API_KEY: 'pa-1' }, fetch: voyage.f })!.embed(['d'], 'document');
    assert.equal(voyage.calls[0].body.input_type, 'document');

    const cohere = fakeFetch((_u, body) => ({ embeddings: { float: body.texts.map(() => [1]) } }));
    await resolveEmbedder({ env: { COHERE_API_KEY: 'co' }, fetch: cohere.f })!.embed(['q'], 'query');
    assert.equal(cohere.calls[0].body.input_type, 'search_query');
  });

  it('is off without a provider that has embeddings, or when pinned off, and never guesses a key', () => {
    assert.equal(resolveEmbedder({ env: {} }), undefined);
    assert.equal(resolveEmbedder({ env: { ANTHROPIC_API_KEY: 'sk-ant-1', GROQ_API_KEY: 'gsk_1' } }), undefined);
    assert.equal(resolveEmbedder({ env: { OPENAI_API_KEY: 'sk-proj-1', BLAZE_EMBED_PROVIDER: 'off' } }), undefined);
    // A universal key whose format says nothing isn't sent to an embeddings provider on a guess.
    assert.equal(resolveEmbedder({ env: { API_KEYS: 'sk-somethingunrecognizable' } }), undefined);
    assert.equal(resolveEmbedder({ env: { API_KEYS: 'sk-ant-1,sk-proj-2' } })?.id, 'openai:text-embedding-3-small');
  });

  it('honors a pinned provider, a model override, a local Ollama and any OpenAI-compatible endpoint', () => {
    const env = { OPENAI_API_KEY: 'sk-proj-1', VOYAGE_API_KEY: 'pa-1' };
    assert.equal(resolveEmbedder({ env: { ...env, BLAZE_EMBED_PROVIDER: 'voyage' } })?.id, 'voyage:voyage-3.5-lite');
    assert.equal(resolveEmbedder({ env: { ...env, BLAZE_EMBED_MODEL: 'text-embedding-3-large' } })?.id, 'openai:text-embedding-3-large');
    assert.equal(resolveEmbedder({ env: { OLLAMA_BASE_URL: 'http://gpu:11434/v1' } })?.id, 'ollama:nomic-embed-text');
    assert.equal(resolveEmbedder({ env: { ...env, BLAZE_EMBED_BASE_URL: 'http://tei:8080/v1', BLAZE_EMBED_MODEL: 'bge-m3' } })?.id, 'custom:bge-m3');
  });

  it('moves to the next key when one is rejected', async () => {
    const api = fakeFetch((_u, body) => ({ data: body.input.map((_: string, index: number) => ({ index, embedding: [1] })) }));
    let n = 0;
    const flaky = (async (url: string, init: any) => (n++ === 0 ? new Response('no', { status: 401 }) : api.f(url, init))) as unknown as typeof fetch;
    const embedder = resolveEmbedder({ env: { OPENAI_API_KEYS: 'sk-proj-a,sk-proj-b' }, fetch: flaky })!;
    assert.deepEqual(await embedder.embed(['x'], 'query'), [[1]]);
    assert.equal(api.calls[0].headers.authorization, 'Bearer sk-proj-b');
  });
});

describe('hybrid search', () => {
  it('finds a section by meaning when it shares no word with the question', async () => {
    const question = 'How can I remove my profile?';
    assert.deepEqual(retrieve(DOCS, question), [], 'keywords alone find nothing');
    const [best] = await search(DOCS, question, { embedder: conceptEmbedder('concept-1').embedder });
    assert.match(best.text, /Close account/);
  });

  it('keeps keyword matches, and ranks a section found both ways first', async () => {
    const results = await search(DOCS, 'export my notes as a pdf download', { embedder: conceptEmbedder('concept-2').embedder });
    assert.match(results[0].text, /pick CSV or PDF/);
    assert.ok(results.length <= 4);
  });

  it('embeds each section once, and only the changed ones when the docs change', async () => {
    const { embedder, embedded } = conceptEmbedder('concept-3');
    await search(DOCS, 'remove my profile', { embedder });
    await search(DOCS, 'invite a teammate', { embedder });
    const documents = () => embedded.filter((e) => e.kind === 'document').length;
    assert.equal(documents(), 3);
    assert.equal(embedded.filter((e) => e.kind === 'query').length, 2);

    await search(`${DOCS}\n## Printing\n\nPress Ctrl+P on any note.\n`, 'print a note', { embedder });
    assert.equal(documents(), 4, 'only the new section');
  });

  it('falls back to keywords when embeddings fail, and leaves a failing provider alone for a while', async () => {
    const { embedder, embedded } = conceptEmbedder('concept-4', { fail: true });
    const results = await search(DOCS, 'how do I export?', { embedder });
    assert.match(results[0].text, /pick CSV or PDF/);
    const calls = embedded.length;
    await search(DOCS, 'how do I share?', { embedder });
    assert.equal(embedded.length, calls, 'not asked again straight away');
  });

  it("doesn't wait past its timeout, and has the docs ready for the next question", async () => {
    const { embedder } = conceptEmbedder('concept-5', { delayMs: 150 });
    const started = Date.now();
    assert.deepEqual(await search(DOCS, 'remove my profile', { embedder, timeoutMs: 20 }), []);
    assert.ok(Date.now() - started < 120);
    await new Promise((r) => setTimeout(r, 200));
    const [best] = await search(DOCS, 'remove my profile', { embedder, timeoutMs: 1_000 });
    assert.match(best.text, /Close account/);
  });

  it('leaves out sections that are only faintly alike', async () => {
    assert.deepEqual(await search(DOCS, 'what is the weather today', { embedder: conceptEmbedder('concept-6').embedder }), []);
  });
});

describe('RAG answers', () => {
  const verdict: Triage = { type: 'question', kind: 'how_to', severity: 'low', summary: 's', steps: [], source: 'llm', injection: false, enterFixLoop: false };

  it('the widget endpoint answers from a section found by meaning', async () => {
    const prompts: string[] = [];
    const complete: Complete = async (_s, user) => (prompts.push(user), '{"answer": "Go to Settings > Account and click Close account."}');
    const answer = await answerQuestion({ message: 'how can I remove my profile?' } as Report, verdict, {
      complete,
      helpDocs: DOCS,
      embedder: conceptEmbedder('concept-7').embedder
    });
    assert.equal(answer, 'Go to Settings > Account and click Close account.');
    assert.match(prompts[0], /<docs>[\s\S]*Close account[\s\S]*<\/docs>/);
  });

  it('the support desk answers from the README, help docs and saved replies', async () => {
    const readme = fakeFetch(() => '');
    const f = (async (url: string) =>
      url.endsWith('/repos/acme/desk/readme') ? new Response('# Desk\n\n## Refund window\n\nRefunds are possible within 14 days of purchase.', { status: 200 }) : readme.f(url, {})) as unknown as typeof fetch;
    const prompts: string[] = [];
    const store = new SupportStore();
    const handler = createSupportHandler({
      store,
      repo: 'acme/desk',
      githubToken: 'tok',
      fetch: f,
      helpDocs: DOCS,
      embed: conceptEmbedder('concept-8').embedder,
      complete: async (_s, user) => (prompts.push(user), '{"reply": "ok"}')
    });
    const create = (rawText: string) =>
      handler(new Request('http://localhost/api/support/tickets/create', { method: 'POST', body: JSON.stringify({ rawText }) }));

    await create('How many days do I have to get a refund?');
    assert.match(prompts[0], /<knowledge>[\s\S]*\[Desk > Refund window\]\nRefunds are possible within 14 days/);

    await create('I want to remove my profile');
    assert.match(prompts[1], /<knowledge>[\s\S]*Close account/, 'help docs, found by meaning');

    await create('please confirm my order dispatch');
    assert.match(prompts[2], /\[Saved reply: Order Status & Dispatch Check\]/);
  });
});
