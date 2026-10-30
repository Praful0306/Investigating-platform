import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '@google/genai';
import { geminiProvider } from '../../src/services/ai/providers/gemini.js';
import { openAiCompatProvider } from '../../src/services/ai/providers/openai-compat.js';
import { buildProvidersFromEnv } from '../../src/services/ai/index.js';
import { jsonSchemaFor } from '../../src/services/ai/schema.js';
import { ProviderError } from '../../src/utils/provider-error.js';
import { DIFFICULTY } from '../../src/config/difficulty.js';

// built from parts so the repo-wide secret grep never matches a key-shaped literal
const KEY = ['AIza', 'SyFAKEFAKEFAKEFAKEFAKEFAKEFAKE12345'].join('');
const jsonSchema = jsonSchemaFor(DIFFICULTY.easy);
const args = (extra = {}) => ({ system: 'SYS', prompt: 'PROMPT', jsonSchema, signal: new AbortController().signal, ...extra });
const caught = (p) => p.then(() => { throw new Error('expected rejection'); }, (e) => e);
const hasKey = (obj, key) => JSON.stringify(obj).includes(`"${key}"`);

describe('geminiProvider', () => {
  const fakeClient = (impl) => ({ models: { generateContent: vi.fn(impl) } });

  it('calls generateContent with JSON mode, system prompt, signal and the user prompt', async () => {
    const client = fakeClient(async () => ({ text: '{"ok":1}' }));
    const p = geminiProvider({ apiKey: KEY, model: 'gemini-test', client });
    const a = args();
    expect(await p.generate(a)).toBe('{"ok":1}');
    const [req] = client.models.generateContent.mock.calls[0];
    expect(req.model).toBe('gemini-test');
    expect(req.contents).toBe('PROMPT');
    expect(req.config).toMatchObject({
      systemInstruction: 'SYS',
      responseMimeType: 'application/json',
      temperature: 0.9,
      abortSignal: a.signal,
    });
    expect(p).toMatchObject({ name: 'gemini', model: 'gemini-test' });
  });

  it('sends the schema without maxLength (unsupported by Gemini) but keeps array sizes and required', async () => {
    const client = fakeClient(async () => ({ text: '{}' }));
    await geminiProvider({ apiKey: KEY, model: 'm', client }).generate(args());
    const sent = client.models.generateContent.mock.calls[0][0].config.responseJsonSchema;
    expect(hasKey(sent, 'maxLength')).toBe(false);
    expect(sent.properties.suspects.minItems).toBe(3);
    expect(sent.properties.suspects.maxItems).toBe(3);
    expect(sent.properties.clues.items.required).toEqual(['id', 'title', 'location', 'description']);
    expect(sent.required).toContain('solution');
    expect(hasKey(jsonSchema, 'maxLength')).toBe(true); // the original schema is not mutated
  });

  it('returns an empty string when the model returned no text (blocked / empty)', async () => {
    const client = fakeClient(async () => ({ text: undefined }));
    expect(await geminiProvider({ apiKey: KEY, model: 'm', client }).generate(args())).toBe('');
  });

  it.each([
    [429, true], [500, true], [503, true], [400, false], [401, false], [403, false], [404, false],
  ])('ApiError %i -> ProviderError retryable=%s, status kept, no provider text leaked', async (status, retryable) => {
    const client = fakeClient(async () => { throw new ApiError({ message: `secret provider detail for ${KEY}`, status }); });
    const e = await caught(geminiProvider({ apiKey: KEY, model: 'm', client }).generate(args()));
    expect(e).toBeInstanceOf(ProviderError);
    expect(e.status).toBe(status);
    expect(e.retryable).toBe(retryable);
    expect(e.message).not.toMatch(/secret provider detail/);
    expect(e.message).not.toContain(KEY);
  });

  it('network failure -> retryable ProviderError', async () => {
    const client = fakeClient(async () => { throw new TypeError('fetch failed'); });
    const e = await caught(geminiProvider({ apiKey: KEY, model: 'm', client }).generate(args()));
    expect(e).toBeInstanceOf(ProviderError);
    expect(e.retryable).toBe(true);
  });

  it('abort / timeout -> ProviderError 504', async () => {
    const client = fakeClient(async () => { throw new DOMException('aborted', 'AbortError'); });
    const e = await caught(geminiProvider({ apiKey: KEY, model: 'm', client }).generate(args()));
    expect([e.constructor, e.status]).toEqual([ProviderError, 504]);
  });
});

describe('openAiCompatProvider', () => {
  const okFetch = (content = '{"ok":1}') =>
    vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 }));
  const make = (fetchImpl, extra = {}) =>
    openAiCompatProvider({ baseUrl: 'https://api.groq.com/openai/v1/', apiKey: 'gsk_FAKEKEY', model: 'llama-x', fetchImpl, ...extra });

  it('posts to {base}/chat/completions with bearer auth, JSON mode and the schema in the system message', async () => {
    const f = okFetch();
    const a = args();
    expect(await make(f).generate(a)).toBe('{"ok":1}');
    const [url, init] = f.mock.calls[0];
    expect(url).toBe('https://api.groq.com/openai/v1/chat/completions');
    expect(init.method).toBe('POST');
    expect(init.signal).toBe(a.signal);
    expect(init.headers).toMatchObject({ 'content-type': 'application/json', authorization: 'Bearer gsk_FAKEKEY' });
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({ model: 'llama-x', temperature: 0.9, response_format: { type: 'json_object' } });
    expect(body.messages[0]).toMatchObject({ role: 'system' });
    expect(body.messages[0].content).toContain('SYS');
    expect(body.messages[0].content).toContain('"minItems":3');
    expect(body.messages[1]).toEqual({ role: 'user', content: 'PROMPT' });
  });

  it('uses the given provider name', () => {
    expect(make(okFetch(), { name: 'groq' })).toMatchObject({ name: 'groq', model: 'llama-x' });
    expect(make(okFetch()).name).toBe('openai_compat');
  });

  it('returns an empty string when there is no content', async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ choices: [] }), { status: 200 }));
    expect(await make(f).generate(args())).toBe('');
  });

  it.each([[429, true], [502, true], [400, false], [401, false]])('HTTP %i -> ProviderError retryable=%s', async (status, retryable) => {
    const f = vi.fn(async () => new Response('{"error":"nope gsk_FAKEKEY"}', { status }));
    const e = await caught(make(f).generate(args()));
    expect(e).toBeInstanceOf(ProviderError);
    expect([e.status, e.retryable]).toEqual([status, retryable]);
    expect(e.message).not.toContain('gsk_FAKEKEY');
    expect(e.message).not.toContain('nope');
  });

  it('network error and non-JSON body -> ProviderError', async () => {
    const down = await caught(make(vi.fn(async () => { throw new TypeError('fetch failed'); })).generate(args()));
    const junk = await caught(make(vi.fn(async () => new Response('<html>', { status: 200 }))).generate(args()));
    for (const e of [down, junk]) expect(e).toBeInstanceOf(ProviderError);
    expect(down.retryable).toBe(true);
  });

  it('abort -> ProviderError 504', async () => {
    const f = vi.fn(async () => { throw new DOMException('aborted', 'AbortError'); });
    const e = await caught(make(f).generate(args()));
    expect([e.constructor, e.status]).toEqual([ProviderError, 504]);
  });
});

describe('buildProvidersFromEnv', () => {
  const base = { NODE_ENV: 'development', GEMINI_MODEL: 'gemini-test' };
  const logger = () => ({ warn: vi.fn() });
  const names = (list) => list.map((p) => p.name);

  it('builds gemini when the key is present', () => {
    expect(names(buildProvidersFromEnv({ ...base, AI_PROVIDERS: 'gemini', GEMINI_API_KEY: KEY }, { logger: logger() }))).toEqual(['gemini']);
  });

  it('keeps the configured order and trims/lowercases names', () => {
    const env = {
      ...base, AI_PROVIDERS: ' OpenAI_Compat , gemini ', GEMINI_API_KEY: KEY,
      OPENAI_COMPAT_BASE_URL: 'https://x/v1', OPENAI_COMPAT_API_KEY: 'k', OPENAI_COMPAT_MODEL: 'm',
    };
    expect(names(buildProvidersFromEnv(env, { logger: logger() }))).toEqual(['openai_compat', 'gemini']);
  });

  it('skips a provider whose settings are missing, with a warning that names it but never prints secrets', () => {
    const l = logger();
    const out = buildProvidersFromEnv({ ...base, AI_PROVIDERS: 'gemini,openai_compat', OPENAI_COMPAT_API_KEY: 'sekrit-value' }, { logger: l });
    expect(out).toEqual([]);
    const logged = l.warn.mock.calls.flat().join(' ');
    expect(logged).toMatch(/gemini/);
    expect(logged).toMatch(/openai_compat/);
    expect(logged).not.toContain('sekrit-value');
  });

  it('skips unknown provider names with a warning', () => {
    const l = logger();
    expect(buildProvidersFromEnv({ ...base, AI_PROVIDERS: 'skynet' }, { logger: l })).toEqual([]);
    expect(l.warn.mock.calls.flat().join(' ')).toMatch(/skynet/);
  });

  it('allows the mock provider outside production', () => {
    expect(names(buildProvidersFromEnv({ ...base, AI_PROVIDERS: 'mock' }, { logger: logger() }))).toEqual(['mock']);
  });

  it('refuses the mock provider in production', () => {
    const l = logger();
    expect(buildProvidersFromEnv({ ...base, NODE_ENV: 'production', AI_PROVIDERS: 'mock' }, { logger: l })).toEqual([]);
    expect(l.warn.mock.calls.flat().join(' ')).toMatch(/mock/);
  });

  it('empty or missing AI_PROVIDERS list builds nothing', () => {
    expect(buildProvidersFromEnv({ ...base, AI_PROVIDERS: '' }, { logger: logger() })).toEqual([]);
    expect(buildProvidersFromEnv({ ...base, AI_PROVIDERS: ' , ' }, { logger: logger() })).toEqual([]);
  });
});
