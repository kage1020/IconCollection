import type { SearchResponse } from '@icon-collection/core';
import { renderHook, waitFor } from '@testing-library/preact';
import type { ComponentChildren } from 'preact';
import { describe, expect, test, vi } from 'vitest';
import type { Host } from '../src/index.ts';
import { HostProvider, useSearch } from '../src/index.ts';
import { makeHost } from './_helpers.ts';

const wrapWith =
  (host: Host) =>
  ({ children }: { children: ComponentChildren }) => (
    <HostProvider host={host}>{children}</HostProvider>
  );

describe('useSearch', () => {
  test('is idle when query is null', () => {
    const search = vi.fn();
    const host = makeHost({ apiClient: { search } });
    const { result } = renderHook(() => useSearch(null), {
      wrapper: wrapWith(host),
    });
    expect(result.current.status).toBe('idle');
    expect(search).not.toHaveBeenCalled();
  });

  test('transitions to success and returns data', async () => {
    const search = vi.fn(async () => ({
      hits: [{ collection: 'mdi', name: 'home', license: 'Apache-2.0', width: 24, height: 24 }],
      total: 1,
      cursor: null,
    }));
    const host = makeHost({ apiClient: { search } });
    const { result } = renderHook(() => useSearch({ q: 'home' }), {
      wrapper: wrapWith(host),
    });
    await waitFor(() => expect(result.current.status).toBe('success'));
    expect(result.current.data?.total).toBe(1);
  });

  test('sets error status when fetch fails', async () => {
    const search = vi.fn(async () => {
      throw new Error('boom');
    });
    const host = makeHost({ apiClient: { search } });
    const { result } = renderHook(() => useSearch({ q: 'home' }), {
      wrapper: wrapWith(host),
    });
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.error).not.toBeNull();
  });

  test('drops stale response when query changes fast', async () => {
    let resolveFirst!: (v: SearchResponse) => void;
    const firstPromise = new Promise<SearchResponse>((r) => {
      resolveFirst = r;
    });
    const secondPromise = Promise.resolve<SearchResponse>({
      hits: [{ collection: 'mdi', name: 'second', license: 'Apache-2.0', width: 24, height: 24 }],
      total: 1,
      cursor: null,
    });
    const search = vi
      .fn<() => Promise<SearchResponse>>()
      .mockReturnValueOnce(firstPromise)
      .mockReturnValueOnce(secondPromise);
    const host = makeHost({ apiClient: { search } });

    const { result, rerender } = renderHook(({ q }: { q: string }) => useSearch({ q }), {
      wrapper: wrapWith(host),
      initialProps: { q: 'a' },
    });
    rerender({ q: 'b' });
    // resolve the stale first request after the second one
    resolveFirst({
      hits: [{ collection: 'mdi', name: 'first', license: 'Apache-2.0', width: 24, height: 24 }],
      total: 1,
      cursor: null,
    });
    await waitFor(() => expect(result.current.status).toBe('success'));
    expect(result.current.data?.hits[0]?.name).toBe('second');
  });
});
