import { DIFFICULTY } from '../../config/difficulty.js';
import { AppError } from '../../utils/app-error.js';
import { ProviderError } from '../../utils/provider-error.js';
import { geminiProvider } from './providers/gemini.js';
import { mockProvider } from './providers/mock.js';
import { openAiCompatProvider } from './providers/openai-compat.js';
import { buildUserPrompt, SYSTEM_PROMPT } from './prompt.js';
import { jsonSchemaFor } from './schema.js';
import { validateGenerated } from './validate.js';

export const DEFAULT_DEADLINE_MS = 60_000;

// A provider that ignores the abort signal must still not hang the request. The abort listener is removed as soon as
// the race is over, so a quick success does not leave a listener (and its closure) behind for the rest of the timeout.
export function withTimeout(promise, signal) {
  let onAbort;
  const timeout = new Promise((_, reject) => {
    onAbort = () => reject(new ProviderError('timed out', 504, true));
    if (signal.aborted) onAbort();
    else signal.addEventListener('abort', onAbort, { once: true });
  });
  return Promise.race([promise, timeout]).finally(() => signal.removeEventListener('abort', onAbort));
}

// provider: { name, model, generate({ system, prompt, jsonSchema, signal }) => Promise<string> }
// maxAttempts is the total across all providers, but every provider gets at least one try: a provider that is not the
// last one stops one attempt short per provider still waiting behind it (so with more providers than maxAttempts the
// total is the number of providers). deadlineMs is the overall time limit: a
// proxy or a phone will not wait longer, and a slow answer after the visitor has left only wastes quota.
export function createAiService(providers, { maxAttempts = 3, timeoutMs = 45000, deadlineMs = DEFAULT_DEADLINE_MS, logger = console } = {}) {
  return {
    async generateCase({ premise, difficulty }) {
      const cfg = DIFFICULTY[difficulty];
      let attempts = 0;
      let feedback = [];
      let sawInvalid = false;
      const t0 = Date.now();
      const remaining = () => deadlineMs - (Date.now() - t0);

      providerLoop:
      for (const [index, p] of providers.entries()) {
        const reserved = providers.length - 1 - index; // tries kept back for the providers behind this one
        let triedHere = 0;
        while (triedHere === 0 || attempts < maxAttempts - reserved) {
          if (remaining() <= 0) break providerLoop;
          attempts++;
          triedHere++;

          // our own code: a bug here must surface as a 500, not be mistaken for a provider outage
          const prompt = buildUserPrompt({ premise, difficulty, cfg, feedback });
          const jsonSchema = jsonSchemaFor(cfg);
          const signal = AbortSignal.timeout(Math.min(timeoutMs, remaining()));

          let raw;
          try {
            raw = await withTimeout(p.generate({ system: SYSTEM_PROMPT, prompt, jsonSchema, signal }), signal);
          } catch (err) {
            logger.warn?.(`[ai] ${p.name} provider error (attempt ${attempts}): ${err.status ?? ''} ${err.message}`);
            break; // provider down / quota / timeout -> next provider
          }

          const v = validateGenerated(raw, difficulty);
          if (v.ok) {
            return { data: v.data, meta: { provider: p.name, model: p.model, attempts, latencyMs: Date.now() - t0 } };
          }
          sawInvalid = true;
          feedback = v.errors;
          logger.warn?.(`[ai] ${p.name} invalid output (attempt ${attempts}): ${v.errors.join('; ')}`);
        }
      }

      if (sawInvalid) throw new AppError('AI_GENERATION_FAILED', 502, 'The AI produced an inconsistent case. Please try again.');
      throw new AppError('AI_UNAVAILABLE', 503, 'The mystery writer is busy right now. Please try again in a minute.');
    },
  };
}

// Maps the AI_PROVIDERS list (ordered) to provider instances. A provider with missing settings is skipped
// with a warning that names the missing variables, never their values.
export function buildProvidersFromEnv(env, { logger = console } = {}) {
  const names = (env.AI_PROVIDERS ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  const providers = [];
  const skip = (name, why) => logger.warn?.(`[ai] provider "${name}" skipped: ${why}`);
  const missing = (...keys) => keys.filter((k) => !env[k]);

  for (const name of names) {
    if (name === 'gemini') {
      const m = missing('GEMINI_API_KEY');
      if (m.length) skip(name, `${m.join(', ')} not set`);
      else providers.push(geminiProvider({ apiKey: env.GEMINI_API_KEY, model: env.GEMINI_MODEL }));
    } else if (name === 'openai_compat') {
      const m = missing('OPENAI_COMPAT_BASE_URL', 'OPENAI_COMPAT_API_KEY', 'OPENAI_COMPAT_MODEL');
      if (m.length) skip(name, `${m.join(', ')} not set`);
      else providers.push(openAiCompatProvider({ baseUrl: env.OPENAI_COMPAT_BASE_URL, apiKey: env.OPENAI_COMPAT_API_KEY, model: env.OPENAI_COMPAT_MODEL }));
    } else if (name === 'mock') {
      if (env.NODE_ENV === 'production') skip(name, 'the mock provider is not allowed in production');
      else providers.push(mockProvider());
    } else {
      skip(name, 'unknown provider');
    }
  }
  return providers;
}
