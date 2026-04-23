import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from 'react';
import { cn } from './cn';

export type TooltipPlacement = 'top' | 'bottom' | 'left' | 'right';

export interface TooltipProps {
  content: ReactNode;
  placement?: TooltipPlacement;
  children: ReactElement;
  className?: string;
}

const PLACEMENT: Record<TooltipPlacement, string> = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  left: 'right-full top-1/2 -translate-y-1/2 mr-2',
  right: 'left-full top-1/2 -translate-y-1/2 ml-2',
};

/**
 * CSS-only tooltip. Uses `group` + `group-hover/group-focus-within` on the wrapper
 * so keyboard focus also reveals it without any JS listeners.
 */
export function Tooltip({ content, placement = 'top', children, className }: TooltipProps) {
  const tooltipId = useId();
  const child = isValidElement(children)
    ? cloneElement(children as ReactElement<{ 'aria-describedby'?: string }>, {
        'aria-describedby': tooltipId,
      })
    : children;

  return (
    <span className="relative inline-flex group">
      {child}
      <span
        id={tooltipId}
        role="tooltip"
        className={cn(
          'pointer-events-none absolute z-tooltip whitespace-nowrap rounded-lg bg-inverse-surface px-2 py-1 text-caption text-inverse-on-surface opacity-0 shadow-glass-sm transition-opacity duration-250 ease-premium group-hover:opacity-100 group-focus-within:opacity-100',
          PLACEMENT[placement],
          className,
        )}
      >
        {content}
      </span>
    </span>
  );
}
