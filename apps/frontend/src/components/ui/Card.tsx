import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from './cn';

export type CardVariant = 'glass' | 'glass-elevated' | 'solid';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  interactive?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const VARIANT: Record<CardVariant, string> = {
  glass: 'glass-card',
  'glass-elevated': 'glass-elevated',
  solid: 'bg-surface-container-lowest border border-outline-variant/40 rounded-2xl shadow-glass-sm',
};

const PADDING: Record<NonNullable<CardProps['padding']>, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-5',
  lg: 'p-7',
};

const CardRoot = forwardRef<HTMLDivElement, CardProps>(function Card(
  { variant = 'glass', interactive = false, padding = 'md', className, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        VARIANT[variant],
        PADDING[padding],
        interactive && 'glass-interactive cursor-pointer',
        className,
      )}
      {...rest}
    />
  );
});

const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(function CardHeader(
  { className, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn('flex items-start justify-between gap-3 pb-3 border-b border-outline-variant/30 mb-3', className)}
      {...rest}
    />
  );
});

const CardBody = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(function CardBody(
  { className, ...rest },
  ref,
) {
  return <div ref={ref} className={cn('flex flex-col gap-3', className)} {...rest} />;
});

const CardFooter = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(function CardFooter(
  { className, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn('flex items-center justify-end gap-2 pt-3 mt-3 border-t border-outline-variant/30', className)}
      {...rest}
    />
  );
});

type CardComponent = typeof CardRoot & {
  Header: typeof CardHeader;
  Body: typeof CardBody;
  Footer: typeof CardFooter;
};

export const Card = CardRoot as CardComponent;
Card.Header = CardHeader;
Card.Body = CardBody;
Card.Footer = CardFooter;
