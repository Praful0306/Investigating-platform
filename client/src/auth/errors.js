const GENERIC = 'Something went wrong. Please try again.';
const NO_MATCH = "That email and password don't match.";

// Firebase error code -> what to tell the player, and which form field it belongs to (null = the form as a whole).
// `silent` is for "the player closed the Google window": nothing to say. The SDK's own message is never shown: it
// can contain internals (project settings, keys).
const MESSAGES = {
  'auth/invalid-credential': { message: NO_MATCH },
  'auth/wrong-password': { message: NO_MATCH },
  'auth/user-not-found': { message: NO_MATCH },
  'auth/invalid-email': { field: 'email', message: "That doesn't look like an email address." },
  'auth/email-already-in-use': { field: 'email', message: 'An account with that email already exists. Try signing in instead.' },
  'auth/weak-password': { field: 'password', message: 'Choose a stronger password (at least 8 characters).' },
  'auth/too-many-requests': { message: 'Too many attempts. Wait a few minutes, or reset your password.' },
  'auth/network-request-failed': { message: "Can't reach the sign-in service. Check your connection and try again." },
  'auth/popup-blocked': { message: 'Your browser blocked the Google window. Allow pop-ups for this site and try again.' },
  'auth/user-disabled': { message: 'This account has been disabled.' },
  'auth/operation-not-allowed': { message: "This sign-in method isn't turned on yet." },
  'auth/account-exists-with-different-credential': { field: 'email', message: 'An account with that email already exists with a different sign-in method.' },
  'auth/unavailable': { message: "Sign-in isn't set up on this site yet. You can still play as a guest." }, // ours: no sign-in service configured
};
const SILENT = new Set(['auth/popup-closed-by-user', 'auth/cancelled-popup-request']);

export function authMessage(err) {
  const code = typeof err?.code === 'string' ? err.code : '';
  if (SILENT.has(code)) return { field: null, message: '', silent: true };
  const known = MESSAGES[code];
  return { field: known?.field ?? null, message: known?.message ?? GENERIC, silent: false };
}
