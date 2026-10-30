import { cn } from '../../lib/cn.js';
import { SpinnerIcon } from './Spinner.jsx';

const VARIANTS = {
  primary: 'bg-amber text-ink shadow-lamp hover:bg-amber-soft active:translate-y-px',
  ghost: 'border border-edge bg-white/[0.03] text-zinc-100 hover:bg-white/[0.08] active:translate-y-px',
  danger: 'bg-blood-deep text-white hover:brightness-110 active:translate-y-px',
};
const SIZES = {
  md: 'min-h-11 px-5 text-sm',
  lg: 'min-h-12 px-7 text-base',
};

// `as` lets it render a router <Link>; `loading` disables it and shows a spinner while keeping the label.
export function Button({ as: Tag = 'button', variant = 'primary', size = 'md', loading = false, className, children, disabled, ...rest }) {
  const isButton = Tag === 'button';
  return (
    <Tag
      data-variant={variant}
      aria-busy={loading || undefined}
      {...(isButton ? { type: 'button', disabled: disabled || loading } : {})}
      {...rest}
      className={cn(
        'inline-flex cursor-pointer select-none items-center justify-center gap-2 rounded-chip font-semibold tracking-wide',
        'transition duration-200 ease-out-expo focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber',
        // busy is not "unavailable": a loading button stays vivid with a progress cursor
        loading ? 'cursor-progress' : 'disabled:cursor-not-allowed disabled:opacity-50',
        VARIANTS[variant] ?? VARIANTS.primary,
        SIZES[size] ?? SIZES.md,
        className,
      )}
    >
      {loading && <SpinnerIcon />}
      {children}
    </Tag>
  );
}
