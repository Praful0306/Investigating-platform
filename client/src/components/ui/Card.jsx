import { cn } from '../../lib/cn.js';

// felt = a dark panel; paper = an evidence card, optionally tilted a degree or two like it was dropped on the desk.
export function Card({ as: Tag = 'div', variant = 'felt', tilt = 0, className, style, children, ...rest }) {
  return (
    <Tag
      data-variant={variant}
      {...rest}
      className={cn(variant === 'paper' ? 'surface-paper' : 'surface-felt', className)}
      style={tilt ? { '--tilt': `${tilt}deg`, ...style } : style}
    >
      {children}
    </Tag>
  );
}
