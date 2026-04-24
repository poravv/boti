import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from './cn';

export type IconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface IconProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  name: string;
  size?: IconSize;
  filled?: boolean;
}

/**
 * Centralises Material Symbols sizing so pages stop reaching for
 * arbitrary pixel classes like `text-[14px]`.
 */
const SIZE_CLASS: Record<IconSize, string> = {
  xs: 'text-[16px] leading-none',
  sm: 'text-[18px] leading-none',
  md: 'text-[20px] leading-none',
  lg: 'text-[24px] leading-none',
  xl: 'text-[32px] leading-none',
};

const OPTICAL_SIZE: Record<IconSize, number> = {
  xs: 20,
  sm: 20,
  md: 24,
  lg: 24,
  xl: 40,
};

export const Icon = forwardRef<HTMLSpanElement, IconProps>(function Icon(
  { name, size = 'md', filled = false, className, style, 'aria-hidden': ariaHidden, ...rest },
  ref,
) {
  return (
    <span
      ref={ref}
      aria-hidden={ariaHidden ?? true}
      className={cn('material-symbols-rounded select-none', SIZE_CLASS[size], className)}
      style={{
        fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' 400, 'GRAD' 0, 'opsz' ${OPTICAL_SIZE[size]}`,
        ...style,
      }}
      {...rest}
    >
      {name}
    </span>
  );
});
