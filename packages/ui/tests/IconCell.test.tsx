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
import { HostProvider, IconCell } from '../src/index.ts';
import { makeHost } from './_helpers.ts';

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

describe('IconCell', () => {
  test('renders SVG after intersecting and fetching', async () => {
    const getSvg = vi.fn(async () => '<svg data-testid="svg"></svg>');
    render(
      <HostProvider host={makeHost({ apiClient: { getSvg } })}>
        <IconCell hit={hit} />
      </HostProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('svg')).toBeInTheDocument());
    expect(getSvg).toHaveBeenCalledTimes(1);
  });

  test('shows a fallback when fetch fails', async () => {
    const getSvg = vi.fn(async () => {
      throw new Error('boom');
    });
    render(
      <HostProvider host={makeHost({ apiClient: { getSvg } })}>
        <IconCell hit={failHit} />
      </HostProvider>,
    );
    await waitFor(() => expect(screen.getByRole('img', { name: /failed/i })).toBeInTheDocument());
  });

  test('invokes onSelect when clicked', async () => {
    const user = userEvent.setup();
    const getSvg = vi.fn(async () => '<svg></svg>');
    const onSelect = vi.fn();
    render(
      <HostProvider host={makeHost({ apiClient: { getSvg } })}>
        <IconCell hit={hit} onSelect={onSelect} />
      </HostProvider>,
    );
    await waitFor(() => screen.getByRole('button', { name: /mdi\/home/i }));
    await user.click(screen.getByRole('button', { name: /mdi\/home/i }));
    expect(onSelect).toHaveBeenCalledWith(hit);
  });

  test('sanitizes malicious SVG markup before rendering', async () => {
    const getSvg = vi.fn(async () => '<svg><script>alert(1)</script><path d="M0 0"/></svg>');
    const { container } = render(
      <HostProvider host={makeHost({ apiClient: { getSvg } })}>
        <IconCell hit={maliciousHit} />
      </HostProvider>,
    );
    await waitFor(() => expect(container.querySelector('path')).toBeInTheDocument());
    expect(screen.queryByText(/alert/i)).toBeNull();
    expect(container.querySelector('script')).toBeNull();
  });
});
