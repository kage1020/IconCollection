import type { IconHit } from '@icon-collection/core';
import { svgToJsx } from '../format.ts';
import { useHost } from '../host.tsx';

export type CopyKind = 'svg' | 'jsx' | 'mx';

export const useCopy = (): ((kind: CopyKind, hit: IconHit) => Promise<void>) => {
  const host = useHost();
  return async (kind, hit) => {
    try {
      const client = host.apiClient;
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
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      host.showToast(`Copy failed: ${message}`);
    }
  };
};
