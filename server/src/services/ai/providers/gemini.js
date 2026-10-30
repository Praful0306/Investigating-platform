import { ApiError, GoogleGenAI } from '@google/genai';
import { ProviderError, retryableStatus } from '../../../utils/provider-error.js';

// Gemini's JSON-schema subset has no `maxLength`; length limits are enforced by validate.js instead.
const withoutMaxLength = (v) => {
  if (Array.isArray(v)) return v.map(withoutMaxLength);
  if (v && typeof v === 'object') {
    return Object.fromEntries(Object.entries(v).filter(([k]) => k !== 'maxLength').map(([k, x]) => [k, withoutMaxLength(x)]));
  }
  return v;
};

// Keep only the HTTP status: provider messages can echo request details, so they never leave this file.
function toProviderError(e) {
  if (e instanceof ProviderError) return e;
  if (e?.name === 'AbortError' || e?.name === 'TimeoutError') return new ProviderError('Gemini request timed out', 504, true);
  if (e instanceof ApiError) return new ProviderError(`Gemini HTTP ${e.status}`, e.status, retryableStatus(e.status));
  return new ProviderError('Gemini network error', undefined, true);
}

export function geminiProvider({ apiKey, model, client = new GoogleGenAI({ apiKey }) }) {
  return {
    name: 'gemini',
    model,
    async generate({ system, prompt, jsonSchema, signal }) {
      try {
        const res = await client.models.generateContent({
          model,
          contents: prompt,
          config: {
            systemInstruction: system,
            responseMimeType: 'application/json',
            responseJsonSchema: withoutMaxLength(jsonSchema),
            temperature: 0.9,
            abortSignal: signal,
          },
        });
        return res.text ?? '';
      } catch (e) {
        throw toProviderError(e);
      }
    },
  };
}
