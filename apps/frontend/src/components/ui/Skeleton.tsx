import type { CSSProperties, HTMLAttributes } from 'react';
import { cn } from './cn';

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  width?: number | string;
  height?: number | string;
  rounded?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

const ROUNDED: Record<NonNullable<SkeletonProps['rounded']>, string> = {
  sm: 'rounded-md',
  md: 'rounded-lg',
  lg: 'rounded-xl',
  xl: 'rounded-2xl',
  full: 'rounded-full',
};

export function Skeleton({ width, height, rounded = 'md', className, style, ...rest }: SkeletonProps) {
  const inlineStyle: CSSProperties = {
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height,
    ...style,
  };
  return <div className={cn('skeleton', ROUNDED[rounded], className)} style={inlineStyle} {...rest} />;
}

export function SkeletonText({
  lines = 3,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {Array.from({ length: lines }).map((_, idx) => (
        <Skeleton
          key={idx}
          height={12}
          width={idx === lines - 1 ? '70%' : '100%'}
          rounded="sm"
        />
      ))}
    </div>
  );
}

export function SkeletonAvatar({ size = 40, className }: { size?: number; className?: string }) {
  return <Skeleton width={size} height={size} rounded="full" className={className} />;
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn('glass-card p-5 flex flex-col gap-4', className)}>
      <div className="flex items-center gap-3">
        <SkeletonAvatar />
        <div className="flex-1">
          <Skeleton height={14} width="60%" />
          <Skeleton height={10} width="40%" className="mt-2" />
        </div>
      </div>
      <SkeletonText lines={3} />
    </div>
  );
}
