import { renderHook, waitFor } from '@testing-library/preact';
import type { ComponentChildren } from 'preact';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { Host } from '../src/index.ts';
import { createSvgCache, HostProvider, useSearch } from '../src/index.ts';

const makeHost = (_fetchImpl: typeof fetch): Host => ({
  apiBaseUrl: 'https://x.example',
  copyText: async () => {},
  showToast: () => {},
  persistState: { get: async () => null, set: async () => {} },
  svgCache: createSvgCache(),
});

const wrapWith =
  (host: Host) =>
  ({ children }: { children: ComponentChildren }) => (
    <HostProvider host={host}>{children}</HostProvider>
  );

const jsonRes = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('useSearch', () => {
  test('is idle when query is null', () => {
    const fetchFn = vi.fn();
    vi.stubGlobal('fetch', fetchFn);
    const { result } = renderHook(() => useSearch(null), {
      wrapper: wrapWith(makeHost(fetch)),
    });
    expect(result.current.status).toBe('idle');
    expect(fetchFn).not.toHaveBeenCalled();
  });

  test('transitions to success and returns data', async () => {
    const fetchFn = vi.fn(async () =>
      jsonRes({
        hits: [{ collection: 'mdi', name: 'home', license: 'Apache-2.0', width: 24, height: 24 }],
        total: 1,
        cursor: null,
      }),
    );
    vi.stubGlobal('fetch', fetchFn);
    const { result } = renderHook(() => useSearch({ q: 'home' }), {
      wrapper: wrapWith(makeHost(fetch)),
    });
    await waitFor(() => expect(result.current.status).toBe('success'));
    expect(result.current.data?.total).toBe(1);
  });

  test('sets error status when fetch fails', async () => {
    const fetchFn = vi.fn(async () => new Response('boom', { status: 500 }));
    vi.stubGlobal('fetch', fetchFn);
    const { result } = renderHook(() => useSearch({ q: 'home' }), {
      wrapper: wrapWith(makeHost(fetch)),
    });
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.error).not.toBeNull();
  });

  test('drops stale response when query changes fast', async () => {
    let resolveFirst!: (v: Response) => void;
    const firstPromise = new Promise<Response>((r) => {
      resolveFirst = r;
    });
    const secondPromise = Promise.resolve(
      jsonRes({
        hits: [{ collection: 'mdi', name: 'second', license: 'Apache-2.0', width: 24, height: 24 }],
        total: 1,
        cursor: null,
      }),
    );
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockReturnValueOnce(firstPromise)
      .mockReturnValueOnce(secondPromise);
    vi.stubGlobal('fetch', fetchFn);

    const { result, rerender } = renderHook(({ q }: { q: string }) => useSearch({ q }), {
      wrapper: wrapWith(makeHost(fetch)),
      initialProps: { q: 'a' },
    });
    rerender({ q: 'b' });
    // resolve the stale first request after the second one
    resolveFirst(
      jsonRes({
        hits: [{ collection: 'mdi', name: 'first', license: 'Apache-2.0', width: 24, height: 24 }],
        total: 1,
        cursor: null,
      }),
    );
    await waitFor(() => expect(result.current.status).toBe('success'));
    expect(result.current.data?.hits[0]?.name).toBe('second');
  });
});
