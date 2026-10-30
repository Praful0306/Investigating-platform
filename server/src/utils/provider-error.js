// Thrown by AI providers for network / quota / auth / timeout problems (not for bad model output).
export class ProviderError extends Error {
  constructor(message, status, retryable = false) {
    super(message);
    this.name = 'ProviderError';
    this.status = status;
    this.retryable = retryable;
  }
}
