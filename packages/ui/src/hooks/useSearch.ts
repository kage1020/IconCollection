import type { SearchQuery, SearchResponse } from '@icon-collection/core';
import { useEffect, useRef, useState } from 'preact/hooks';
import { useHost } from '../host.tsx';

export type SearchStatus = 'idle' | 'loading' | 'success' | 'error';

export type SearchState = {
  status: SearchStatus;
  data: SearchResponse | null;
  error: Error | null;
};

const IDLE: SearchState = { status: 'idle', data: null, error: null };

export const useSearch = (query: SearchQuery | null): SearchState => {
  const host = useHost();
  const client = host.apiClient;
  const [state, setState] = useState<SearchState>(IDLE);
  const genRef = useRef(0);
  const key = query ? JSON.stringify(query) : null;

  useEffect(() => {
    if (!query || query.q.trim().length === 0) {
      setState(IDLE);
      return;
    }
    const gen = ++genRef.current;
    setState({ status: 'loading', data: null, error: null });
    client
      .search(query)
      .then((data) => {
        if (gen !== genRef.current) return;
        setState({ status: 'success', data, error: null });
      })
      .catch((error: unknown) => {
        if (gen !== genRef.current) return;
        setState({
          status: 'error',
          data: null,
          error: error instanceof Error ? error : new Error(String(error)),
        });
      });
  }, [client, key]);

  return state;
};
