import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from './cn';
import { Icon, type IconSize } from './Icon';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'icon';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leadingIcon?: string;
  trailingIcon?: string;
  fullWidth?: boolean;
}

const BASE =
  'inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all duration-250 ease-premium focus-ring disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none select-none';

const VARIANT: Record<ButtonVariant, string> = {
  primary:
    'bg-primary text-white shadow-glass-sm hover:opacity-90 hover:shadow-glass hover:-translate-y-0.5 active:translate-y-0 active:shadow-glass-sm active:opacity-100',
  secondary:
    'bg-white text-primary border border-outline-variant shadow-glass-sm hover:bg-surface-container-low hover:shadow-glass hover:-translate-y-0.5 active:translate-y-0',
  ghost:
    'bg-transparent text-on-surface hover:bg-surface-container-high/60 active:bg-surface-container-high',
  danger:
    'bg-error text-white shadow-glass-sm hover:shadow-glass hover:-translate-y-0.5 active:translate-y-0',
  icon:
    'bg-transparent text-on-surface hover:bg-surface-container-high/60 rounded-full p-0 active:bg-surface-container-high',
};

const SIZE: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-body-sm',
  md: 'h-10 px-4 text-body',
  lg: 'h-12 px-6 text-body-lg',
};

const ICON_SIZE_FOR_BUTTON: Record<ButtonSize, string> = {
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-12 w-12',
};

const ICON_INNER_SIZE: Record<ButtonSize, IconSize> = {
  sm: 'sm',
  md: 'md',
  lg: 'lg',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading = false,
    leadingIcon,
    trailingIcon,
    fullWidth = false,
    disabled,
    className,
    children,
    type = 'button',
    ...rest
  },
  ref,
) {
  const isIconOnly = variant === 'icon';
  const sizeClass = isIconOnly ? ICON_SIZE_FOR_BUTTON[size] : SIZE[size];

  let content: ReactNode = children;
  if (loading) {
    content = (
      <>
        <Icon name="progress_activity" size={ICON_INNER_SIZE[size]} className="animate-spin" />
        {!isIconOnly && children ? <span>{children}</span> : null}
      </>
    );
  } else {
    content = (
      <>
        {leadingIcon ? <Icon name={leadingIcon} size={ICON_INNER_SIZE[size]} /> : null}
        {children ? <span className="truncate">{children}</span> : null}
        {trailingIcon ? <Icon name={trailingIcon} size={ICON_INNER_SIZE[size]} /> : null}
      </>
    );
  }

  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(BASE, VARIANT[variant], sizeClass, fullWidth && 'w-full', className)}
      {...rest}
    >
      {content}
    </button>
  );
});
