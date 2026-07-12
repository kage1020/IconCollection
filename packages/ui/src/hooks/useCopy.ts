import type { IconHit } from '@icon-collection/core';
import { createApiClient } from '@icon-collection/core';
import { useMemo } from 'preact/hooks';
import { svgToJsx } from '../format.ts';
import { useHost } from '../host.tsx';

export type CopyKind = 'svg' | 'jsx' | 'mx';

export const useCopy = (): ((kind: CopyKind, hit: IconHit) => Promise<void>) => {
  const host = useHost();
  const client = useMemo(() => createApiClient({ baseUrl: host.apiBaseUrl }), [host.apiBaseUrl]);
  return async (kind, hit) => {
    try {
      if (kind === 'svg') {
        const svg = await client.getSvg(hit.collection, hit.name);
        await host.copyText(svg);
      } else if (kind === 'jsx') {
        const svg = await client.getSvg(hit.collection, hit.name);
        await host.copyText(svgToJsx(svg));
      } else {
        const mx = await client.getMx(hit.collection, hit.name);
        await host.copyText(mx);
      }
      host.showToast('Copied');
    } catch {
      host.showToast('Copy failed');
    }
  };
};
