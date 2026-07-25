import type { IconHit } from '@icon-collection/core';
import { IconCell } from './IconCell.tsx';

export type IconGridProps = {
  hits: readonly IconHit[];
  columns?: number;
  cellSize?: number;
  onSelect?: (hit: IconHit) => void;
};

// virtua の VGrid による仮想スクロールは Web ビルドで有効化する予定。
// テスト環境（happy-dom）では layout 情報が乏しく仮想化が機能しないため、
// 非仮想の CSS grid を既定とする。
export const IconGrid = ({ hits, columns = 6, cellSize = 64, onSelect }: IconGridProps) => {
  return (
    <div
      class="grid gap-2"
      style={{
        gridTemplateColumns: `repeat(${columns}, minmax(0, ${cellSize}px))`,
      }}
    >
      {hits.map((hit) => (
        <IconCell
          key={`${hit.collection}/${hit.name}`}
          hit={hit}
          {...(onSelect ? { onSelect } : {})}
        />
      ))}
    </div>
  );
};
