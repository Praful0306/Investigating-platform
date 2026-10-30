import { ProviderError, retryableStatus } from '../../../utils/provider-error.js';

// One adapter for any OpenAI-compatible chat endpoint (Groq, Cloudflare Workers AI /ai/v1, xAI, OpenRouter, ...).
export function openAiCompatProvider({ baseUrl, apiKey, model, name = 'openai_compat', fetchImpl = fetch }) {
  const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`;
  return {
    name,
    model,
    async generate({ system, prompt, jsonSchema, signal }) {
      let r;
      try {
        r = await fetchImpl(url, {
          method: 'POST',
          signal,
          headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model,
            temperature: 0.9,
            response_format: { type: 'json_object' },
            messages: [
              { role: 'system', content: `${system}\nJSON schema:\n${JSON.stringify(jsonSchema)}` },
              { role: 'user', content: prompt },
            ],
          }),
        });
      } catch (e) {
        if (e?.name === 'AbortError' || e?.name === 'TimeoutError') throw new ProviderError(`${name} request timed out`, 504, true);
        throw new ProviderError(`${name} network error`, undefined, true);
      }
      // Error bodies are never read or logged: they can echo request details.
      if (!r.ok) throw new ProviderError(`${name} HTTP ${r.status}`, r.status, retryableStatus(r.status));
      let body;
      try {
        body = await r.json();
      } catch {
        throw new ProviderError(`${name} returned an unreadable response`, 502, true);
      }
      return body.choices?.[0]?.message?.content ?? '';
    },
  };
}
