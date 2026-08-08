import type { IconHit } from '@icon-collection/core';
import DOMPurify from 'dompurify';
import { useEffect, useRef, useState } from 'preact/hooks';
import { useHost } from './host.tsx';

const sanitizeSvg = (body: string): string =>
  DOMPurify.sanitize(body, { USE_PROFILES: { svg: true, svgFilters: true } });

export type IconCellProps = {
  hit: IconHit;
  onSelect?: (hit: IconHit) => void;
  selected?: boolean;
};

type CellStatus = 'idle' | 'loading' | 'ready' | 'error';

const cacheKey = (h: IconHit) => `${h.collection}/${h.name}`;

export const IconCell = ({ hit, onSelect, selected = false }: IconCellProps) => {
  const host = useHost();
  const client = host.apiClient;
  const [status, setStatus] = useState<CellStatus>(() =>
    host.svgCache.has(cacheKey(hit)) ? 'ready' : 'idle',
  );
  const [svg, setSvg] = useState<string | null>(() => host.svgCache.get(cacheKey(hit)) ?? null);
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
              host.svgCache.set(cacheKey(hit), sanitized);
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

  const base =
    'group relative flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border bg-white p-2 text-neutral-700 shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-50 dark:bg-neutral-900 dark:text-neutral-200 dark:focus-visible:ring-offset-neutral-950';
  const state = selected
    ? 'border-sky-500 ring-2 ring-sky-400 ring-offset-2 ring-offset-neutral-50 dark:ring-offset-neutral-950'
    : 'border-neutral-200 dark:border-neutral-800';

  return (
    <button
      ref={containerRef}
      type="button"
      class={`${base} ${state}`}
      aria-label={`${hit.collection}/${hit.name}`}
      aria-pressed={selected}
      onClick={() => onSelect?.(hit)}
    >
      <span class="flex flex-1 items-center justify-center [font-size:2rem] leading-none">
        {status === 'ready' && svg ? (
          <span
            class="block h-8 w-8 text-neutral-800 transition-colors group-hover:text-sky-600 dark:text-neutral-100 dark:group-hover:text-sky-400 [&_svg]:h-full [&_svg]:w-full"
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        ) : status === 'error' ? (
          <span role="img" aria-label="failed" class="text-neutral-400">
            ?
          </span>
        ) : (
          <span
            aria-busy
            class="h-8 w-8 animate-pulse rounded bg-neutral-100 dark:bg-neutral-800"
          />
        )}
      </span>
      <span class="w-full truncate text-center text-[10px] text-neutral-500 dark:text-neutral-400">
        {hit.name}
      </span>
    </button>
  );
};
