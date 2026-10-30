const LABELS = ['Too short', 'Okay', 'Good', 'Strong'];
export const MIN_PASSWORD = 8;

// A friendly nudge, not a gate: the only rule that blocks sign-up is the length. One point for being long enough,
// one for 12 or more characters, one for mixing letters with digits or symbols (capped at 3).
export function passwordStrength(password) {
  const chars = typeof password === 'string' ? Array.from(password) : [];
  if (chars.length < MIN_PASSWORD) return { level: 0, label: LABELS[0] };
  const text = chars.join('');
  const mixed = /[a-z]/i.test(text) && /[^a-z]/i.test(text);
  const level = Math.min(3, 1 + (chars.length >= 12 ? 1 : 0) + (mixed ? 1 : 0));
  return { level, label: LABELS[level] };
}
