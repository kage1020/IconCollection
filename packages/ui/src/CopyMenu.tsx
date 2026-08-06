import type { IconHit } from '@icon-collection/core';
import { useCopy } from './hooks/useCopy.ts';

export type CopyMenuProps = { hit: IconHit };

export const CopyMenu = ({ hit }: CopyMenuProps) => {
  const copy = useCopy();
  const button =
    'inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 shadow-sm transition hover:-translate-y-0.5 hover:border-sky-300 hover:text-sky-700 hover:shadow-md active:translate-y-0 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:border-sky-500 dark:hover:text-sky-400';
  return (
    <div class="flex flex-wrap gap-2">
      <button type="button" class={button} onClick={() => copy('svg', hit)}>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect>
          <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path>
        </svg>
        SVG
      </button>
      <button type="button" class={button} onClick={() => copy('jsx', hit)}>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <polyline points="16 18 22 12 16 6"></polyline>
          <polyline points="8 6 2 12 8 18"></polyline>
        </svg>
        JSX
      </button>
      <button type="button" class={button} onClick={() => copy('mx', hit)}>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <rect width="8" height="8" x="3" y="3" rx="1"></rect>
          <rect width="8" height="8" x="13" y="13" rx="1"></rect>
          <path d="M11 7h2"></path>
          <path d="M7 11v2"></path>
        </svg>
        Diagram
      </button>
    </div>
  );
};
