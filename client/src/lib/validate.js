const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@.]+$/;

// A forgiving "does this look like an email" check for form feedback. The real judge is Firebase.
export function isEmail(value) {
  if (typeof value !== 'string') return false;
  const v = value.trim();
  return v.length <= 254 && EMAIL.test(v);
}
