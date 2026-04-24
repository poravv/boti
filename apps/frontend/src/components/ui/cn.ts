import clsx, { type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Merges Tailwind classes correctly — last conflicting class wins (e.g. bg-primary overrides bg-surface)
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
