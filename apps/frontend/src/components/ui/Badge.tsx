import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from './cn';

export type BadgeVariant = 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'neutral';
export type BadgeSize = 'sm' | 'md';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  /** Render only a pulsing dot (used as a live indicator). */
  dot?: boolean;
}

const VARIANT: Record<BadgeVariant, string> = {
  primary: 'bg-action/10 text-action border border-action/20',
  secondary: 'bg-secondary/10 text-secondary border border-secondary/20',
  success: 'bg-success-container text-on-success-container border border-success/20',
  warning: 'bg-warning-container text-on-warning-container border border-warning/20',
  danger: 'bg-error-container text-on-error-container border border-error/20',
  neutral: 'bg-surface-container-high text-on-surface-variant border border-outline-variant/40',
};

const DOT_COLOR: Record<BadgeVariant, string> = {
  primary: 'bg-action',
  secondary: 'bg-secondary',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-error',
  neutral: 'bg-on-surface-variant',
};

const SIZE: Record<BadgeSize, string> = {
  sm: 'h-5 px-2 text-overline gap-1',
  md: 'h-6 px-2.5 text-caption gap-1.5',
};

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
  { variant = 'neutral', size = 'md', dot = false, className, children, ...rest },
  ref,
) {
  if (dot) {
    // Dot badges are purely decorative by default; callers that want them announced
    // must provide `aria-label` (promotes the element to role="status" for screen readers).
    const hasLabel = typeof rest['aria-label'] === 'string' && rest['aria-label'].length > 0;
    return (
      <span
        ref={ref}
        role={hasLabel ? 'status' : undefined}
        aria-hidden={hasLabel ? undefined : true}
        className={cn('relative inline-flex h-2.5 w-2.5 items-center justify-center', className)}
        {...rest}
      >
        <span className={cn('absolute inset-0 rounded-full animate-ping opacity-70', DOT_COLOR[variant])} />
        <span className={cn('relative h-2 w-2 rounded-full', DOT_COLOR[variant])} />
      </span>
    );
  }

  return (
    <span
      ref={ref}
      className={cn(
        'inline-flex items-center rounded-full font-semibold whitespace-nowrap',
        SIZE[size],
        VARIANT[variant],
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  );
});
