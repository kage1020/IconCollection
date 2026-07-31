import type { ApiClient } from '@icon-collection/core';
import type { Host } from '../src/host.tsx';
import { createSvgCache } from '../src/svg-cache.ts';

export type HostOverride = Partial<Omit<Host, 'apiClient'>> & {
  apiClient?: Partial<ApiClient>;
};

export const makeHost = (over: HostOverride = {}): Host => ({
  apiBaseUrl: 'https://example.test',
  svgCache: createSvgCache(),
  copyText: async () => undefined,
  showToast: () => undefined,
  persistState: { get: async () => null, set: async () => undefined },
  ...over,
  apiClient: {
    search: async () => ({ hits: [], total: 0, cursor: null }),
    getSvg: async () => '<svg/>',
    getMx: async () => '<mx/>',
    ...(over.apiClient ?? {}),
  } as ApiClient,
});
