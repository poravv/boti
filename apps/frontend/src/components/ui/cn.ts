import clsx, { type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// Custom font-size names from tailwind.config.js — without this, twMerge treats
// text-body/text-caption/etc. as color classes and silently drops text-white.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [
        {
          text: [
            'display-lg', 'display-md', 'display-sm',
            'heading-lg', 'heading-md', 'heading-sm',
            'title',
            'body-lg', 'body', 'body-sm',
            'caption', 'overline',
          ],
        },
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
