// @vitest-environment jsdom
//
// This file exercises the real DOMPurify.sanitize() path (see IconCell.tsx).
// DOMPurify's realm-safe cached-getter checks (Node.prototype getter invoked
// via `.call()`) return empty strings for every node under happy-dom's
// Proxy-based element implementation, which makes `sanitize()` strip all
// elements including the wrapping `<svg>`. jsdom's Node.prototype getters
// behave correctly when invoked via `.call()`, so this file opts into jsdom
// for a correct sanitize() result while the rest of the suite stays on the
// project-wide happy-dom environment.
import type { IconHit } from '@icon-collection/core';
import { render, screen, waitFor } from '@testing-library/preact';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import type { Host } from '../src/index.ts';
import { createSvgCache, HostProvider, IconCell } from '../src/index.ts';

const hit: IconHit = {
  collection: 'mdi',
  name: 'home',
  license: 'Apache-2.0',
  width: 24,
  height: 24,
};

// Distinct cache key from `hit` so the instance svgCache (populated by
// the preceding success test) does not short-circuit this failure case.
const failHit: IconHit = { ...hit, name: 'home-error' };

// Distinct cache key so the instance svgCache from other tests
// does not short-circuit this sanitization test.
const maliciousHit: IconHit = { ...hit, name: 'home-xss' };

const makeHost = (_fetchFn: typeof fetch): Host => ({
  apiBaseUrl: 'https://x.example',
  copyText: async () => {},
  showToast: () => {},
  persistState: { get: async () => null, set: async () => {} },
  svgCache: createSvgCache(),
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

  test('sanitizes malicious SVG markup before rendering', async () => {
    const fetchFn = vi.fn(
      async () =>
        new Response('<svg><script>alert(1)</script><path d="M0 0"/></svg>', {
          status: 200,
          headers: { 'content-type': 'image/svg+xml' },
        }),
    );
    vi.stubGlobal('fetch', fetchFn);
    const { container } = render(
      <HostProvider host={makeHost(fetch)}>
        <IconCell hit={maliciousHit} />
      </HostProvider>,
    );
    await waitFor(() => expect(container.querySelector('path')).toBeInTheDocument());
    expect(screen.queryByText(/alert/i)).toBeNull();
    expect(container.querySelector('script')).toBeNull();
  });
});
