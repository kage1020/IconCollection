import type { ApiClient, SearchQuery } from '@icon-collection/core';
import { createApiClient } from '@icon-collection/core';
import type { FilterValue, Host } from '@icon-collection/ui';
import {
  createSvgCache,
  FilterBar,
  HostProvider,
  IconGrid,
  SearchBox,
  useSearch,
} from '@icon-collection/ui';
import { useMemo, useState } from 'preact/hooks';
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

const SearchInner = () => {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<FilterValue>({ collection: [], license: [] });
  const query: SearchQuery | null = q.trim()
    ? {
        q,
        ...(filter.collection.length > 0 ? { collection: filter.collection } : {}),
        ...(filter.license.length > 0 ? { license: filter.license } : {}),
        limit: 60,
      }
    : null;
  const state = useSearch(query);
  return (
    <div class="flex flex-col gap-4">
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
        <IconGrid hits={state.data?.hits ?? []} />
      )}
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
