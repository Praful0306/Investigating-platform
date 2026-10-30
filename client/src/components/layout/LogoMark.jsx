// The brand mark: a magnifying glass with a keyhole in the lens. Decorative; the wordmark next to it carries the name.
export function LogoMark({ className = 'size-8' }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" className={className}>
      <circle cx="14" cy="14" r="8" stroke="currentColor" strokeWidth="2.4" />
      <path d="M20 20l6.5 6.5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <circle cx="14" cy="12.4" r="2" fill="currentColor" />
      <path d="M14 14.2v3.4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
