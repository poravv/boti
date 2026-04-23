import type { ReactNode } from 'react';
import { cn } from './cn';
import { Icon } from './Icon';

export interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon = 'inbox',
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 text-center py-10 px-6',
        className,
      )}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-container-high/70 text-on-surface-variant">
        <Icon name={icon} size="lg" />
      </div>
      <div className="flex flex-col gap-1">
        <h3 className="text-heading-sm text-on-surface">{title}</h3>
        {description ? (
          <p className="text-body-sm text-on-surface-variant max-w-md">{description}</p>
        ) : null}
      </div>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
