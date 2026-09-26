import { describe, it, mock } from 'node:test';
import assert from 'node:assert';
import {
  ProviderError,
  azureOpenAIComplete,
  describeProviders,
  geminiComplete,
  identifyKey,
  listProviders,
  nvidiaComplete,
  openaiComplete,
  resolveApiKeys,
  resolveComplete,
  withKeyRotation
} from '../triage/providers.js';

/** A fake network: `routes` maps a URL substring to a reply; every request is recorded. */
function fakeApis(routes: Record<string, (init: any) => Response>) {
  const calls: { url: string; method: string; body?: any; headers: any }[] = [];
  mock.method(globalThis, 'fetch', async (url: string, init: any = {}) => {
    calls.push({ url: String(url), method: init.method ?? 'GET', body: init.body ? JSON.parse(init.body) : undefined, headers: init.headers ?? {} });
    const hit = Object.keys(routes).find((r) => String(url).includes(r));
    return hit ? routes[hit](init) : new Response('{}', { status: 401 });
  });
  return calls;
}
const chatReply = (text: string) => () => new Response(JSON.stringify({ choices: [{ message: { content: text } }] }));
const anthropicReply = (text: string) => () => new Response(JSON.stringify({ content: [{ type: 'text', text }] }));

describe('auto-identifying keys', () => {
  it('recognizes providers from the key format alone', () => {
    const cases: [string, string | undefined][] = [
      ['sk-ant-api03-abc', 'anthropic'],
      ['sk-proj-abc', 'openai'],
      ['sk-abcT3BlbkFJxyz', 'openai'],
      ['sk-or-v1-abc', 'openrouter'],
      ['sk-0123456789abcdef0123456789abcdef', 'deepseek'],
      ['AIzaSyA1234567890abcdefghijklmnopqrstu', 'gemini'],
      ['gsk_abc', 'groq'],
      ['nvapi-abc', 'nvidia'],
      ['xai-abc', 'xai'],
      ['pplx-abc', 'perplexity'],
      ['fw_abc', 'fireworks'],
      ['csk-abc', 'cerebras'],
      ['hf_abc', 'huggingface'],
      ['github_pat_abc', 'github-models'],
      ['0123456789abcdef0123456789abcdef.AbCdEfGhIjKlMnOp', 'zhipu'],
      ['sk-somethingelse', undefined],
      ['plainopaquekey123', undefined]
    ];
    for (const [key, provider] of cases) assert.equal(identifyKey(key), provider, key);
  });

  it('routes each key in one API_KEYS list to its own provider, in priority order, with failover', async () => {
    const calls = fakeApis({
      'api.anthropic.com': () => new Response('{}', { status: 529 }),
      'api.groq.com': chatReply('from groq')
    });
    try {
      const complete = resolveComplete({ env: { API_KEYS: 'gsk_route1,sk-ant-route1' } })!;
      assert.equal(await complete('s', 'u'), 'from groq');
      assert.deepEqual(calls.map((c) => new URL(c.url).host), ['api.anthropic.com', 'api.groq.com'], 'anthropic first, groq takes over');
      assert.equal(calls[0].headers['x-api-key'], 'sk-ant-route1', 'the anthropic key only goes to anthropic');
      assert.equal(calls[1].headers.authorization, 'Bearer gsk_route1', 'the groq key only goes to groq');

      calls.length = 0;
      assert.equal(await complete('s', 'u'), 'from groq');
      assert.deepEqual(calls.map((c) => new URL(c.url).host), ['api.groq.com'], 'a provider that just failed sits out');
    } finally {
      mock.restoreAll();
    }
  });

  it('accepts the variable names people already use (GOOGLE_API_KEY, HF_TOKEN, ...)', () => {
    assert.match(describeProviders({ GOOGLE_API_KEY: 'AIzaSyAliasAliasAliasAliasAliasAliasAli' }).join('\n'), /^gemini: /);
    assert.match(describeProviders({ HF_TOKEN: 'hf_alias1234567' }).join('\n'), /^huggingface: /);
  });

  it('with BLAZE_KEY_PROBE=on, asks the likely providers once about a key whose format says nothing, then remembers', async () => {
    const calls = fakeApis({
      'api.together.xyz/v1/models': () => new Response('{"data":[]}'),
      'api.together.xyz/v1/chat/completions': chatReply('from together')
    });
    try {
      const complete = resolveComplete({ env: { API_KEY: 'opaque-probe-key-0001', BLAZE_KEY_PROBE: 'on' } })!;
      assert.equal(await complete('s', 'u'), 'from together');
      assert.ok(calls.some((c) => c.url === 'https://api.mistral.ai/v1/models'), 'asked mistral first');
      assert.ok(!calls.some((c) => c.url.includes('api.openai.com')), 'sk- only providers are not asked about other keys');
      calls.length = 0;
      assert.equal(await complete('s', 'u'), 'from together');
      assert.deepEqual(calls.map((c) => c.url), ['https://api.together.xyz/v1/chat/completions'], 'no second round of asking');
    } finally {
      mock.restoreAll();
    }
  });

  it('by default never shows a key to providers it may not belong to: it skips it and says how to name it', async () => {
    const calls = fakeApis({ 'api.groq.com': chatReply('from groq') });
    const warn = mock.method(console, 'warn', () => {});
    try {
      assert.equal(resolveComplete({ env: { API_KEY: 'opaque-probe-key-0002' } }), undefined);
      assert.match(String(warn.mock.calls[0].arguments[0]), /MISTRAL_API_KEY.*BLAZE_KEY_PROBE=on/);

      const complete = resolveComplete({ env: { API_KEYS: 'opaque-probe-key-0003,gsk_default1' } })!;
      assert.equal(await complete('s', 'u'), 'from groq', 'recognized keys still work');
      assert.deepEqual(calls.map((c) => new URL(c.url).host), ['api.groq.com'], 'no probing requests at all');
      assert.match(describeProviders({ API_KEY: 'opaque-probe-key-0003' }).join('\n'), /skipped, provider unknown/);
    } finally {
      mock.restoreAll();
    }
  });

  it('sends BLAZE_MODEL only to providers that serve it, and puts its owner first', async () => {
    const calls = fakeApis({ 'api.groq.com': chatReply('ok'), 'api.anthropic.com': anthropicReply('ok'), 'api.openai.com': chatReply('ok') });
    try {
      await resolveComplete({ env: { API_KEYS: 'gsk_model1', BLAZE_MODEL: 'claude-sonnet-5' } })!('s', 'u');
      assert.equal(calls[0].body.model, 'llama-3.3-70b-versatile', 'a Claude model name never goes to Groq');

      calls.length = 0;
      await resolveComplete({ env: { API_KEYS: 'gsk_model2', BLAZE_MODEL: 'llama-3.1-8b-instant' } })!('s', 'u');
      assert.equal(calls[0].body.model, 'llama-3.1-8b-instant');

      calls.length = 0;
      await resolveComplete({ env: { API_KEYS: 'sk-ant-model3,sk-proj-model3', BLAZE_MODEL: 'gpt-4.1' } })!('s', 'u');
      assert.equal(new URL(calls[0].url).host, 'api.openai.com', 'the provider that owns the model goes first');
      assert.equal(calls[0].body.model, 'gpt-4.1');
    } finally {
      mock.restoreAll();
    }
  });

  it('picks up Azure and Ollama from their settings, with no BLAZE_PROVIDER', () => {
    const azure = describeProviders({ API_KEY: 'azureopaquekey0001', AZURE_OPENAI_ENDPOINT: 'https://r.openai.azure.com', AZURE_OPENAI_DEPLOYMENT: 'd' });
    assert.match(azure.join('\n'), /^azure-openai: azur…0001 \(Azure endpoint is set\)$/);
    assert.deepEqual(describeProviders({ OLLAMA_BASE_URL: 'http://box:11434/v1' }), ['ollama: no key needed']);
  });

  it('never prints a whole key', () => {
    const out = describeProviders({ API_KEYS: 'sk-ant-supersecretvalue1234' }).join('\n');
    assert.ok(!out.includes('supersecretvalue'));
    assert.match(out, /anthropic: sk-a…1234 \(key format\)/);
  });
});

describe('resolveApiKeys', () => {
  it('reads comma-separated, numbered and single provider-specific keys', () => {
    assert.deepEqual(resolveApiKeys('ANTHROPIC', { ANTHROPIC_API_KEYS: 'a,b, c' }), ['a', 'b', 'c']);
    assert.deepEqual(resolveApiKeys('ANTHROPIC', { ANTHROPIC_API_KEY_1: 'x', ANTHROPIC_API_KEY_2: 'y' }), ['x', 'y']);
    assert.deepEqual(resolveApiKeys('ANTHROPIC', { ANTHROPIC_API_KEY: 'z' }), ['z']);
  });

  it('stops at the first missing numbered key (no gaps)', () => {
    assert.deepEqual(resolveApiKeys('ANTHROPIC', { ANTHROPIC_API_KEY_1: 'x', ANTHROPIC_API_KEY_3: 'skipped' }), ['x']);
  });

  it('falls back to the universal API_KEY(S) when no provider-specific key is set', () => {
    assert.deepEqual(resolveApiKeys('OPENAI', { API_KEYS: 'u1,u2' }), ['u1', 'u2']);
    assert.deepEqual(resolveApiKeys('OPENAI', { API_KEY: 'universal' }), ['universal']);
  });

  it('pools provider-specific and universal keys together, deduplicated, provider-specific first', () => {
    const keys = resolveApiKeys('OPENAI', { OPENAI_API_KEY: 'shared', API_KEYS: 'shared,extra' });
    assert.deepEqual(keys, ['shared', 'extra']);
  });

  it('returns nothing when no key of any kind is configured', () => {
    assert.deepEqual(resolveApiKeys('OPENAI', {}), []);
  });
});

describe('withKeyRotation', () => {
  it('returns undefined for no keys, and skips the wrapper entirely for exactly one', async () => {
    assert.equal(withKeyRotation([], () => async () => 'x'), undefined);
    let builds = 0;
    const complete = withKeyRotation(['only'], (key) => {
      builds++;
      return async () => `used ${key}`;
    });
    assert.equal(builds, 1);
    assert.equal(await complete!('s', 'u'), 'used only');
  });

  it('round-robins across multiple keys on success', async () => {
    const complete = withKeyRotation(['a', 'b', 'c'], (key) => async () => key)!;
    assert.deepEqual([await complete('', ''), await complete('', ''), await complete('', ''), await complete('', '')], ['a', 'b', 'c', 'a']);
  });

  it('retries the next key on a rate-limit or auth error, and returns the first success', async () => {
    const tried: string[] = [];
    const complete = withKeyRotation(['bad', 'good'], (key) => async () => {
      tried.push(key);
      if (key === 'bad') throw new ProviderError('rate limited', 429);
      return 'ok';
    })!;
    assert.equal(await complete('', ''), 'ok');
    assert.deepEqual(tried, ['bad', 'good']);
  });

  it('gives up after every key fails with a retryable error', async () => {
    const complete = withKeyRotation(['a', 'b'], () => async () => {
      throw new ProviderError('nope', 401);
    })!;
    await assert.rejects(complete('', ''), /nope/);
  });

  it('does not try another key for a non-retryable error (e.g. a timeout)', async () => {
    const tried: string[] = [];
    const complete = withKeyRotation(['a', 'b'], (key) => async () => {
      tried.push(key);
      throw new Error('boom');
    })!;
    await assert.rejects(complete('', ''), /boom/);
    assert.deepEqual(tried, ['a']);
  });
});

describe('resolveComplete (provider auto-detection)', () => {
  it('returns undefined when nothing is configured', () => {
    assert.equal(resolveComplete({ env: {} }), undefined);
  });

  it('picks anthropic first when several provider keys are set', async () => {
    mock.method(globalThis, 'fetch', async (url: string) => {
      assert.match(String(url), /anthropic\.com/);
      return new Response(JSON.stringify({ content: [{ type: 'text', text: 'from anthropic' }] }));
    });
    try {
      const complete = resolveComplete({ env: { ANTHROPIC_API_KEY: 'a', OPENAI_API_KEY: 'o' } });
      assert.equal(await complete!('s', 'u'), 'from anthropic');
    } finally {
      mock.restoreAll();
    }
  });

  it('falls through to the next provider when an earlier one has no key', async () => {
    mock.method(globalThis, 'fetch', async (url: string) => {
      assert.match(String(url), /openai\.com/);
      return new Response(JSON.stringify({ choices: [{ message: { content: 'from openai' } }] }));
    });
    try {
      const complete = resolveComplete({ env: { OPENAI_API_KEY: 'o' } });
      assert.equal(await complete!('s', 'u'), 'from openai');
    } finally {
      mock.restoreAll();
    }
  });

  it('BLAZE_PROVIDER forces a specific provider even if an earlier one in priority order has a key', async () => {
    mock.method(globalThis, 'fetch', async (url: string) => {
      assert.match(String(url), /generativelanguage\.googleapis\.com/);
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'from gemini' }] } }] }));
    });
    try {
      const complete = resolveComplete({ env: { ANTHROPIC_API_KEY: 'a', GEMINI_API_KEY: 'g', BLAZE_PROVIDER: 'gemini' } });
      assert.equal(await complete!('s', 'u'), 'from gemini');
    } finally {
      mock.restoreAll();
    }
  });

  it('warns and returns undefined for an unknown BLAZE_PROVIDER', () => {
    const warn = mock.method(console, 'warn', () => {});
    try {
      assert.equal(resolveComplete({ env: { ANTHROPIC_API_KEY: 'a', BLAZE_PROVIDER: 'not-a-real-provider' } }), undefined);
      assert.equal(warn.mock.calls.length, 1);
    } finally {
      mock.restoreAll();
    }
  });

  it('never auto-selects a key-less provider like ollama', () => {
    assert.equal(resolveComplete({ env: {} }), undefined);
  });
});

describe('provider request shapes', () => {
  it('openaiComplete sends an OpenAI-style chat completion and parses the reply', async () => {
    mock.method(globalThis, 'fetch', async (url: string, init: any) => {
      const body = JSON.parse(init.body);
      assert.equal(init.headers.authorization, 'Bearer sk-test');
      assert.deepEqual(body.messages, [{ role: 'system', content: 'sys' }, { role: 'user', content: 'usr' }]);
      return new Response(JSON.stringify({ choices: [{ message: { content: 'reply' } }] }));
    });
    try {
      assert.equal(await openaiComplete({ apiKey: 'sk-test' })!('sys', 'usr'), 'reply');
    } finally {
      mock.restoreAll();
    }
  });

  it('geminiComplete sends the Google generateContent shape and parses the reply', async () => {
    mock.method(globalThis, 'fetch', async (url: string, init: any) => {
      assert.match(String(url), /key=sk-gem/);
      const body = JSON.parse(init.body);
      assert.equal(body.systemInstruction.parts[0].text, 'sys');
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'reply' }] } }] }));
    });
    try {
      assert.equal(await geminiComplete({ apiKey: 'sk-gem' })!('sys', 'usr'), 'reply');
    } finally {
      mock.restoreAll();
    }
  });

  it('rotates OpenAI keys on a 429 from the first one', async () => {
    const keysSeen: string[] = [];
    mock.method(globalThis, 'fetch', async (url: string, init: any) => {
      const key = init.headers.authorization.replace('Bearer ', '');
      keysSeen.push(key);
      if (key === 'sk-1') return new Response('{}', { status: 429 });
      return new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }));
    });
    try {
      const complete = openaiComplete({ env: { OPENAI_API_KEYS: 'sk-1,sk-2' } });
      assert.equal(await complete!('sys', 'usr'), 'ok');
      assert.deepEqual(keysSeen, ['sk-1', 'sk-2']);
    } finally {
      mock.restoreAll();
    }
  });

  it('nvidiaComplete hits the NVIDIA NIM catalog by default, and a self-hosted NIM via NVIDIA_BASE_URL', async () => {
    mock.method(globalThis, 'fetch', async (url: string) => {
      assert.match(String(url), /integrate\.api\.nvidia\.com/);
      return new Response(JSON.stringify({ choices: [{ message: { content: 'nim reply' } }] }));
    });
    try {
      assert.equal(await nvidiaComplete({ apiKey: 'nvapi-test' })!('sys', 'usr'), 'nim reply');
    } finally {
      mock.restoreAll();
    }

    mock.method(globalThis, 'fetch', async (url: string) => {
      assert.match(String(url), /^http:\/\/localhost:8000\/v1/);
      return new Response(JSON.stringify({ choices: [{ message: { content: 'self-hosted' } }] }));
    });
    try {
      const complete = nvidiaComplete({ env: { NVIDIA_API_KEY: 'nvapi-test', NVIDIA_BASE_URL: 'http://localhost:8000/v1' } });
      assert.equal(await complete!('sys', 'usr'), 'self-hosted');
    } finally {
      mock.restoreAll();
    }
  });

  it('azureOpenAIComplete needs an endpoint and deployment, not just a key, and uses an api-key header', async () => {
    assert.equal(azureOpenAIComplete({ apiKey: 'k', env: {} }), undefined, 'no endpoint/deployment configured');
    assert.equal(
      azureOpenAIComplete({ apiKey: 'k', env: { AZURE_OPENAI_ENDPOINT: 'https://my-resource.openai.azure.com' } }),
      undefined,
      'missing the deployment name'
    );

    mock.method(globalThis, 'fetch', async (url: string, init: any) => {
      assert.equal(url, 'https://my-resource.openai.azure.com/openai/deployments/my-deploy/chat/completions?api-version=2024-08-01-preview');
      assert.equal(init.headers['api-key'], 'azkey');
      assert.equal(init.headers.authorization, undefined);
      return new Response(JSON.stringify({ choices: [{ message: { content: 'azure reply' } }] }));
    });
    try {
      const complete = azureOpenAIComplete({
        apiKey: 'azkey',
        env: { AZURE_OPENAI_ENDPOINT: 'https://my-resource.openai.azure.com', AZURE_OPENAI_DEPLOYMENT: 'my-deploy' }
      });
      assert.equal(await complete!('sys', 'usr'), 'azure reply');
    } finally {
      mock.restoreAll();
    }
  });

  it('lists every provider, including the opt-in-only ones', () => {
    const names = listProviders().map((p) => p.name);
    for (const name of ['anthropic', 'openai', 'nvidia', 'cohere', 'github-models', 'ollama', 'azure-openai']) {
      assert.ok(names.includes(name), `expected ${name} in listProviders()`);
    }
    assert.ok(names.length >= 25, `expected at least 25 providers, got ${names.length}`);
  });
});
