// Player-facing wording for API error codes (SPEC §5.2, specs/04-frontend.md §3). The raw code never reaches the screen.
const GENERIC = 'Something went wrong. Please try again.';

const MESSAGES = {
  RATE_LIMITED: "You've opened a lot of cases. Take a breather and try again in a few minutes.",
  AI_GENERATION_FAILED: 'Our mystery writer tangled the plot. Try again — it usually works on the next try.',
  AI_UNAVAILABLE: 'The mystery writer is busy. Try again in a minute.',
  FORBIDDEN: 'This case file belongs to another detective.',
  CASE_NOT_FOUND: "We couldn't find that case.",
  CLUE_NOT_FOUND: "We couldn't find that clue.",
  SUSPECT_NOT_FOUND: "We couldn't find that suspect.",
  INVALID_ID: "That case link doesn't look right.",
  ROUTE_NOT_FOUND: "We couldn't find what you were looking for.",
  CASE_ALREADY_COMPLETED: 'This case is already closed.',
  CASE_NOT_COMPLETED: 'Accuse a suspect first to see the result.',
  NO_HINTS_LEFT: 'There are no hints left for this case.',
  CAPTCHA_FAILED: 'The bot check failed. Please try again.',
  UNAUTHORIZED: 'Please sign in to continue.',
  EMAIL_TAKEN: 'An account with that email already exists.',
  UNSUPPORTED_MEDIA_TYPE: GENERIC,
  INTERNAL_ERROR: 'The server had a problem. Please try again.',
};

// Errors where pressing "Try again" can plausibly help. Rate limits need a wait, not a retry.
const RETRYABLE = new Set(['NETWORK', 'TIMEOUT', 'AI_GENERATION_FAILED', 'AI_UNAVAILABLE', 'INTERNAL_ERROR']);

export function friendlyMessage(err) {
  const code = typeof err?.code === 'string' ? err.code : undefined;
  if (code && MESSAGES[code]) return MESSAGES[code];
  // A plain { status, code, message } from our API layer carries a message written for players
  // (validation text, "Cannot reach the server…"). A real Error object does not: never show its text.
  const message = !(err instanceof Error) && typeof err?.message === 'string' ? err.message.trim() : '';
  if (message) return message;
  return code === 'VALIDATION_ERROR' ? 'Please check what you entered and try again.' : GENERIC;
}

export function isRetryable(err) {
  return typeof err?.code === 'string' && RETRYABLE.has(err.code);
}
