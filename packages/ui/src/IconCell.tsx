import type { IconHit } from '@icon-collection/core';
import { createApiClient } from '@icon-collection/core';
import DOMPurify from 'dompurify';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { useHost } from './host.tsx';

const sanitizeSvg = (body: string): string =>
  DOMPurify.sanitize(body, { USE_PROFILES: { svg: true, svgFilters: true } });

export type IconCellProps = {
  hit: IconHit;
  onSelect?: (hit: IconHit) => void;
};

type CellStatus = 'idle' | 'loading' | 'ready' | 'error';

const svgCache = new Map<string, string>();
const cacheKey = (h: IconHit) => `${h.collection}/${h.name}`;

export const IconCell = ({ hit, onSelect }: IconCellProps) => {
  const host = useHost();
  const client = useMemo(() => createApiClient({ baseUrl: host.apiBaseUrl }), [host.apiBaseUrl]);
  const [status, setStatus] = useState<CellStatus>(() =>
    svgCache.has(cacheKey(hit)) ? 'ready' : 'idle',
  );
  const [svg, setSvg] = useState<string | null>(() => svgCache.get(cacheKey(hit)) ?? null);
  const containerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (status !== 'idle') return;
    const target = containerRef.current;
    if (!target) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          observer.disconnect();
          setStatus('loading');
          client
            .getSvg(hit.collection, hit.name)
            .then((body) => {
              const sanitized = sanitizeSvg(body);
              svgCache.set(cacheKey(hit), sanitized);
              setSvg(sanitized);
              setStatus('ready');
            })
            .catch(() => setStatus('error'));
        }
      },
      { rootMargin: '128px' },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [status, client, hit.collection, hit.name]);

  return (
    <button
      ref={containerRef}
      type="button"
      class="flex aspect-square flex-col items-center justify-center rounded border border-neutral-200 p-2 hover:border-neutral-400"
      aria-label={`${hit.collection}/${hit.name}`}
      onClick={() => onSelect?.(hit)}
    >
      {status === 'ready' && svg ? (
        <span
          class="h-8 w-8 [&_svg]:h-full [&_svg]:w-full"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      ) : status === 'error' ? (
        <span role="img" aria-label="failed" class="text-neutral-400">
          ?
        </span>
      ) : (
        <span aria-busy class="h-8 w-8 animate-pulse rounded bg-neutral-100" />
      )}
      <span class="mt-1 truncate text-[10px] text-neutral-500">{hit.name}</span>
    </button>
  );
};
