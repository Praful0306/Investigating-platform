import { DIFFICULTY } from '../../config/difficulty.js';
import { AppError } from '../../utils/app-error.js';
import { ProviderError } from '../../utils/provider-error.js';
import { buildUserPrompt, SYSTEM_PROMPT } from './prompt.js';
import { jsonSchemaFor } from './schema.js';
import { validateGenerated } from './validate.js';

// A provider that ignores the abort signal must still not hang the request.
function withTimeout(promise, signal) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      signal.addEventListener('abort', () => reject(new ProviderError('timed out', 504, true)), { once: true });
    }),
  ]);
}

// provider: { name, model, generate({ system, prompt, jsonSchema, signal }) => Promise<string> }
export function createAiService(providers, { maxAttempts = 3, timeoutMs = 45000, logger = console } = {}) {
  return {
    async generateCase({ premise, difficulty }) {
      const cfg = DIFFICULTY[difficulty];
      let attempts = 0;
      let feedback = [];
      let sawInvalid = false;
      const t0 = Date.now();

      for (const p of providers) {
        while (attempts < maxAttempts) {
          attempts++;
          try {
            const signal = AbortSignal.timeout(timeoutMs);
            const raw = await withTimeout(p.generate({
              system: SYSTEM_PROMPT,
              prompt: buildUserPrompt({ premise, difficulty, cfg, feedback }),
              jsonSchema: jsonSchemaFor(cfg),
              signal,
            }), signal);
            const v = validateGenerated(raw, difficulty);
            if (v.ok) {
              return { data: v.data, meta: { provider: p.name, model: p.model, attempts, latencyMs: Date.now() - t0 } };
            }
            sawInvalid = true;
            feedback = v.errors;
            logger.warn?.(`[ai] ${p.name} invalid output (attempt ${attempts}): ${v.errors.join('; ')}`);
          } catch (err) {
            logger.warn?.(`[ai] ${p.name} provider error (attempt ${attempts}): ${err.status ?? ''} ${err.message}`);
            break; // provider down / quota / timeout -> next provider
          }
        }
      }

      if (sawInvalid) throw new AppError('AI_GENERATION_FAILED', 502, 'The AI produced an inconsistent case. Please try again.');
      throw new AppError('AI_UNAVAILABLE', 503, 'The mystery writer is busy right now. Please try again in a minute.');
    },
  };
}
