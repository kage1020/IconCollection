import type { IconHit } from '@icon-collection/core';
import { render, screen, waitFor } from '@testing-library/preact';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import type { Host } from '../src/index.ts';
import { HostProvider, IconCell } from '../src/index.ts';

const hit: IconHit = {
  collection: 'mdi',
  name: 'home',
  license: 'Apache-2.0',
  width: 24,
  height: 24,
};

// Distinct cache key from `hit` so the module-singleton svgCache (populated by
// the preceding success test) does not short-circuit this failure case.
const failHit: IconHit = { ...hit, name: 'home-error' };

const makeHost = (_fetchFn: typeof fetch): Host => ({
  apiBaseUrl: 'https://x.example',
  copyText: async () => {},
  showToast: () => {},
  persistState: { get: async () => null, set: async () => {} },
});

describe('IconCell', () => {
  test('renders SVG after intersecting and fetching', async () => {
    const fetchFn = vi.fn(
      async () =>
        new Response('<svg data-testid="svg"></svg>', {
          status: 200,
          headers: { 'content-type': 'image/svg+xml' },
        }),
    );
    vi.stubGlobal('fetch', fetchFn);
    render(
      <HostProvider host={makeHost(fetch)}>
        <IconCell hit={hit} />
      </HostProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('svg')).toBeInTheDocument());
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  test('shows a fallback when fetch fails', async () => {
    const fetchFn = vi.fn(async () => new Response('bad', { status: 500 }));
    vi.stubGlobal('fetch', fetchFn);
    render(
      <HostProvider host={makeHost(fetch)}>
        <IconCell hit={failHit} />
      </HostProvider>,
    );
    await waitFor(() => expect(screen.getByRole('img', { name: /failed/i })).toBeInTheDocument());
  });

  test('invokes onSelect when clicked', async () => {
    const user = userEvent.setup();
    const fetchFn = vi.fn(
      async () =>
        new Response('<svg></svg>', {
          status: 200,
          headers: { 'content-type': 'image/svg+xml' },
        }),
    );
    vi.stubGlobal('fetch', fetchFn);
    const onSelect = vi.fn();
    render(
      <HostProvider host={makeHost(fetch)}>
        <IconCell hit={hit} onSelect={onSelect} />
      </HostProvider>,
    );
    await waitFor(() => screen.getByRole('button', { name: /mdi\/home/i }));
    await user.click(screen.getByRole('button', { name: /mdi\/home/i }));
    expect(onSelect).toHaveBeenCalledWith(hit);
  });
});
