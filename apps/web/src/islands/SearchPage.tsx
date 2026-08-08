import type { ApiClient, IconHit, SearchQuery } from '@icon-collection/core';
import { createApiClient } from '@icon-collection/core';
import type { FilterValue, Host } from '@icon-collection/ui';
import {
  CopyMenu,
  createSvgCache,
  EmptyState,
  FilterBar,
  HostProvider,
  IconGrid,
  SearchBox,
  useSearch,
} from '@icon-collection/ui';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { pushToast, ToastHost } from './ToastHost.tsx';

export type SearchPageProps = { apiBaseUrl: string };

const useHost = (apiBaseUrl: string): Host =>
  useMemo(() => {
    const base = apiBaseUrl || (typeof location !== 'undefined' ? location.origin : '');
    const apiClient: ApiClient = createApiClient({ baseUrl: base });
    return {
      apiBaseUrl: base,
      apiClient,
      svgCache: createSvgCache(),
      copyText: async (s) => {
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
          await navigator.clipboard.writeText(s);
        }
      },
      showToast: (m) => pushToast(m),
      persistState: {
        get: async (k) => (typeof localStorage !== 'undefined' ? localStorage.getItem(k) : null),
        set: async (k, v) => {
          if (typeof localStorage !== 'undefined') localStorage.setItem(k, v);
        },
      },
    };
  }, [apiBaseUrl]);

const COLLECTION_OPTIONS = [
  { name: 'mdi', label: 'MDI' },
  { name: 'lucide', label: 'Lucide' },
  { name: 'heroicons', label: 'Heroicons' },
  { name: 'tabler', label: 'Tabler' },
] as const;

const LICENSE_OPTIONS = ['Apache-2.0', 'MIT', 'ISC', 'CC-BY-4.0'] as const;

const formatCount = (n: number): string => n.toLocaleString('en-US');

type ResultBodyProps = {
  status: ReturnType<typeof useSearch>['status'];
  hits: readonly IconHit[];
  hasQuery: boolean;
  selectedKey: string | null;
  onSelect: (hit: IconHit) => void;
  errorMessage: string | undefined;
};

const ResultBody = ({
  status,
  hits,
  hasQuery,
  selectedKey,
  onSelect,
  errorMessage,
}: ResultBodyProps) => {
  if (status === 'error') {
    return (
      <div class="flex flex-col gap-2">
        <EmptyState variant="error" />
        {errorMessage ? (
          <p class="text-center text-xs text-red-600 dark:text-red-400">{errorMessage}</p>
        ) : null}
      </div>
    );
  }
  if (!hasQuery) return <EmptyState variant="idle" />;
  if (status === 'success' && hits.length === 0) return <EmptyState variant="empty" />;
  return <IconGrid hits={hits} onSelect={onSelect} {...(selectedKey ? { selectedKey } : {})} />;
};

const SelectedDetail = ({ hit, onClose }: { hit: IconHit; onClose: () => void }) => (
  <aside class="sticky top-6 flex flex-col gap-4 rounded-2xl border border-neutral-200 bg-white/80 p-5 shadow-lg backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/70">
    <div class="flex items-start justify-between gap-2">
      <div class="flex flex-col">
        <span class="text-[11px] font-semibold uppercase tracking-wider text-sky-600 dark:text-sky-400">
          {hit.collection}
        </span>
        <h2 class="text-lg font-semibold text-neutral-900 dark:text-neutral-100">{hit.name}</h2>
        <span class="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
          {hit.license} · {hit.width}×{hit.height}
        </span>
      </div>
      <button
        type="button"
        aria-label="Close details"
        onClick={onClose}
        class="rounded-full p-1.5 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M18 6 6 18"></path>
          <path d="m6 6 12 12"></path>
        </svg>
      </button>
    </div>
    <div class="flex aspect-square items-center justify-center overflow-hidden rounded-xl border border-dashed border-neutral-200 bg-neutral-50 [font-size:6rem] text-neutral-800 dark:border-neutral-700 dark:bg-neutral-950/60 dark:text-neutral-100">
      <img
        src={`/icon/${hit.collection}/${hit.name}.svg`}
        alt=""
        class="h-24 w-24 [color-scheme:normal]"
        loading="lazy"
      />
    </div>
    <div class="flex flex-col gap-2">
      <span class="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
        Copy
      </span>
      <CopyMenu hit={hit} />
    </div>
  </aside>
);

const SearchInner = () => {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<FilterValue>({ collection: [], license: [] });
  const [selectedHit, setSelectedHit] = useState<IconHit | null>(null);
  const query: SearchQuery | null = q.trim()
    ? {
        q,
        ...(filter.collection.length > 0 ? { collection: filter.collection } : {}),
        ...(filter.license.length > 0 ? { license: filter.license } : {}),
        limit: 60,
      }
    : null;
  const state = useSearch(query);
  const hits = state.data?.hits ?? [];
  const total = state.data?.total ?? 0;
  const selectedKey = selectedHit ? `${selectedHit.collection}/${selectedHit.name}` : null;

  useEffect(() => {
    setSelectedHit(null);
  }, [q, filter]);

  const errorMessage = state.status === 'error' && state.error ? state.error.message : undefined;

  return (
    <div class="flex flex-col gap-6">
      <div class="flex flex-col gap-3">
        <SearchBox
          initialValue={q}
          onChange={setQ}
          placeholder="Search 55,000+ icons — try 'home', 'arrow', or 'ホーム'"
        />
        <FilterBar
          collections={COLLECTION_OPTIONS}
          licenses={LICENSE_OPTIONS}
          value={filter}
          onChange={setFilter}
        />
      </div>

      <div class="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section class="flex flex-col gap-3">
          <div class="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
            <span aria-live="polite">
              {state.status === 'loading' && q.trim()
                ? 'Searching…'
                : q.trim() && state.status === 'success'
                  ? `${formatCount(total)} matches`
                  : 'Type to search'}
            </span>
          </div>
          <ResultBody
            status={state.status}
            hits={hits}
            hasQuery={q.trim().length > 0}
            selectedKey={selectedKey}
            onSelect={setSelectedHit}
            errorMessage={errorMessage}
          />
        </section>

        <div class="lg:min-h-[400px]">
          {selectedHit ? (
            <SelectedDetail hit={selectedHit} onClose={() => setSelectedHit(null)} />
          ) : (
            <div class="sticky top-6 hidden flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-neutral-300 bg-white/50 p-8 text-center text-xs text-neutral-500 lg:flex dark:border-neutral-700 dark:bg-neutral-900/40 dark:text-neutral-400">
              <div class="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <path d="M9 11l3 3L22 4"></path>
                  <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
                </svg>
              </div>
              <p class="text-sm font-medium text-neutral-700 dark:text-neutral-200">Pick an icon</p>
              <p>Click a result to preview and copy.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const SearchPage = ({ apiBaseUrl }: SearchPageProps) => {
  const host = useHost(apiBaseUrl);
  return (
    <HostProvider host={host}>
      <SearchInner />
      <ToastHost />
    </HostProvider>
  );
};
