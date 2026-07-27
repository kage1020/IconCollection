import { renderHook } from '@testing-library/preact';
import type { ComponentChildren } from 'preact';
import { expect, it, vi } from 'vitest';
import type { Host } from '../src/host.tsx';
import { createSvgCache, HostProvider, useSearch } from '../src/index.ts';

it('useSearch calls host.apiClient.search (no createApiClient inside)', async () => {
  const search = vi.fn(async () => ({ hits: [], total: 0, cursor: null }));
  const host: Host = {
    apiBaseUrl: 'https://example.test',
    apiClient: {
      search,
      getSvg: async () => '',
      getMx: async () => '',
    },
    svgCache: createSvgCache(),
    copyText: async () => undefined,
    showToast: () => undefined,
    persistState: { get: async () => null, set: async () => undefined },
  };
  const wrapper = ({ children }: { children: ComponentChildren }) => (
    <HostProvider host={host}>{children}</HostProvider>
  );
  renderHook(() => useSearch({ q: 'x' }), { wrapper });
  await vi.waitFor(() => expect(search).toHaveBeenCalled());
  expect(search).toHaveBeenCalledWith({ q: 'x' });
});
