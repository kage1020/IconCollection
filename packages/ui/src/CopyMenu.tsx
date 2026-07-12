import type { IconHit } from '@icon-collection/core';
import { useCopy } from './hooks/useCopy.ts';

export type CopyMenuProps = { hit: IconHit };

export const CopyMenu = ({ hit }: CopyMenuProps) => {
  const copy = useCopy();
  const button = 'rounded border border-neutral-300 px-2 py-1 text-xs hover:border-neutral-500';
  return (
    <div class="flex gap-1">
      <button type="button" class={button} onClick={() => copy('svg', hit)}>
        SVG
      </button>
      <button type="button" class={button} onClick={() => copy('jsx', hit)}>
        JSX
      </button>
      <button type="button" class={button} onClick={() => copy('mx', hit)}>
        Diagram
      </button>
    </div>
  );
};
