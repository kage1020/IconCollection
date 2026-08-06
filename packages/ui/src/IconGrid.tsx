import type { IconHit } from '@icon-collection/core';
import { IconCell } from './IconCell.tsx';

export type IconGridProps = {
  hits: readonly IconHit[];
  columns?: number;
  cellSize?: number;
  onSelect?: (hit: IconHit) => void;
  selectedKey?: string;
};

// Virtualisation via virtua's VGrid is planned for the web build. In the test
// environment (happy-dom) layout metrics are unreliable and virtualisation
// misbehaves, so we default to a non-virtualised CSS grid.
//
// When callers pass an explicit `columns`, we honour it (this preserves the
// unit-test contract). Without one, we let the grid reflow responsively based
// on `cellSize` — icon walls look better wide than in a fixed 6-column strip.
export const IconGrid = ({
  hits,
  columns,
  cellSize = 88,
  onSelect,
  selectedKey,
}: IconGridProps) => {
  const style =
    typeof columns === 'number'
      ? { gridTemplateColumns: `repeat(${columns}, minmax(0, ${cellSize}px))` }
      : { gridTemplateColumns: `repeat(auto-fill, minmax(${cellSize}px, 1fr))` };
  return (
    <div class="grid gap-2 sm:gap-3" style={style}>
      {hits.map((hit) => {
        const key = `${hit.collection}/${hit.name}`;
        return (
          <IconCell
            key={key}
            hit={hit}
            selected={selectedKey === key}
            {...(onSelect ? { onSelect } : {})}
          />
        );
      })}
    </div>
  );
};
