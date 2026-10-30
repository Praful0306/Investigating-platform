// Joins class names, skipping anything falsy. Enough for this project; no clsx/tailwind-merge needed.
export function cn(...parts) {
  return parts.flat(Infinity).filter(Boolean).join(' ');
}
