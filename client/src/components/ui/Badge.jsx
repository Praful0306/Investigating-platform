import { cn } from '../../lib/cn.js';

const TONES = {
  easy: 'border-moss/40 bg-moss/10 text-moss',
  medium: 'border-amber/40 bg-amber/10 text-amber',
  hard: 'border-blood/40 bg-blood/10 text-blood-soft',
  success: 'border-moss/40 bg-moss/10 text-moss',
  danger: 'border-blood/40 bg-blood/10 text-blood-soft',
  neutral: 'border-edge bg-white/[0.04] text-mist',
};

export function Badge({ tone = 'neutral', className, children, ...rest }) {
  return (
    <span
      data-tone={tone}
      {...rest}
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-mono text-xs font-medium uppercase tracking-wider',
        TONES[tone] ?? TONES.neutral,
        className,
      )}
    >
      {children}
    </span>
  );
}
