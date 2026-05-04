import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from './cn';
import { Icon, type IconSize } from './Icon';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'icon';
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
  'inline-flex items-center justify-center gap-2 font-semibold rounded-md transition-all duration-250 ease-premium focus-ring disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none select-none cursor-pointer';

const VARIANT: Record<ButtonVariant, string> = {
  primary:
    'bg-primary text-white shadow-sm hover:bg-primary/90 hover:shadow-action-glow-sm hover:-translate-y-0.5 active:translate-y-0',
  secondary:
    'bg-secondary text-white shadow-sm hover:bg-secondary/90 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0',
  outline:
    'border-2 border-action text-action bg-transparent hover:bg-action hover:text-white hover:-translate-y-0.5 active:translate-y-0 hover:shadow-action-glow-sm',
  ghost:
    'bg-transparent text-foreground hover:bg-accent hover:text-accent-foreground',
  danger:
    'bg-destructive text-white shadow-sm hover:bg-destructive/90 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0',
  icon:
    'bg-transparent text-foreground hover:bg-accent hover:text-accent-foreground rounded-full p-2',
};

const SIZE: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
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
