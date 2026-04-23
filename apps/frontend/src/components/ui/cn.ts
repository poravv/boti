import clsx, { type ClassValue } from 'clsx';

/**
 * Class name helper. Thin wrapper over clsx to standardise the import path
 * and keep the option open to swap implementations (e.g. tailwind-merge) later.
 */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}
