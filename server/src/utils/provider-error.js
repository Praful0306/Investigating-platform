// Quota (429) and server-side (5xx) failures may pass on their own; auth / bad-request ones will not.
export const retryableStatus = (status) => status === 429 || status >= 500;

// Thrown by AI providers for network / quota / auth / timeout problems (not for bad model output).
export class ProviderError extends Error {
  constructor(message, status, retryable = false) {
    super(message);
    this.name = 'ProviderError';
    this.status = status;
    this.retryable = retryable;
  }
}
