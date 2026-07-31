import type { IconHit, SearchQuery } from '@icon-collection/core';
import type { FilterValue, Host } from '@icon-collection/ui';
import {
  CopyMenu,
  FilterBar,
  HostProvider,
  IconGrid,
  SearchBox,
  useSearch,
} from '@icon-collection/ui';
import { useEffect, useState } from 'preact/hooks';

const COLLECTION_OPTIONS = [
  { name: 'mdi', label: 'MDI' },
  { name: 'lucide', label: 'Lucide' },
  { name: 'heroicons', label: 'Heroicons' },
  { name: 'tabler', label: 'Tabler' },
] as const;

const LICENSE_OPTIONS = ['Apache-2.0', 'MIT', 'ISC', 'CC-BY-4.0'] as const;

const SearchInner = ({ defaultLimit }: { defaultLimit: number }) => {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<FilterValue>({ collection: [], license: [] });
  const [selectedHit, setSelectedHit] = useState<IconHit | null>(null);
  const query: SearchQuery | null = q.trim()
    ? {
        q,
        ...(filter.collection.length > 0 ? { collection: filter.collection } : {}),
        ...(filter.license.length > 0 ? { license: filter.license } : {}),
        limit: defaultLimit,
      }
    : null;
  const state = useSearch(query);

  // 検索条件が変わると同じ選択が別の結果を指す可能性があるため、選択状態をクリアする。
  useEffect(() => {
    setSelectedHit(null);
  }, [q, filter]);

  return (
    <div class="flex flex-col gap-4 p-3">
      <SearchBox initialValue={q} onChange={setQ} placeholder="Search icons…" />
      <FilterBar
        collections={COLLECTION_OPTIONS}
        licenses={LICENSE_OPTIONS}
        value={filter}
        onChange={setFilter}
      />
      {state.status === 'error' ? (
        <p class="text-red-600">Error: {state.error?.message}</p>
      ) : (
        <IconGrid hits={state.data?.hits ?? []} onSelect={setSelectedHit} />
      )}
      {selectedHit ? (
        <div class="flex flex-col gap-2 rounded border border-neutral-200 p-2">
          <div class="flex items-center justify-between text-xs">
            <span>
              {selectedHit.collection}/{selectedHit.name}
            </span>
            <button
              type="button"
              class="text-neutral-500 hover:text-neutral-800"
              onClick={() => setSelectedHit(null)}
            >
              Close
            </button>
          </div>
          <CopyMenu hit={selectedHit} />
        </div>
      ) : null}
    </div>
  );
};

export type SearchPageProps = { host: Host; defaultLimit: number };

export const SearchPage = ({ host, defaultLimit }: SearchPageProps) => (
  <HostProvider host={host}>
    <SearchInner defaultLimit={defaultLimit} />
  </HostProvider>
);
