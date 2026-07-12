import type { IconHit } from '@icon-collection/core';
import { render, screen, waitFor } from '@testing-library/preact';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import type { Host } from '../src/index.ts';
import { CopyMenu, HostProvider } from '../src/index.ts';

const hit: IconHit = {
  collection: 'mdi',
  name: 'home',
  license: 'Apache-2.0',
  width: 24,
  height: 24,
};

const setupHost = () => {
  const copyText = vi.fn(async () => {});
  const showToast = vi.fn();
  const host: Host = {
    apiBaseUrl: 'https://x.example',
    copyText,
    showToast,
    persistState: { get: async () => null, set: async () => {} },
  };
  return { host, copyText, showToast };
};

describe('CopyMenu', () => {
  test('SVG button copies raw SVG', async () => {
    const user = userEvent.setup();
    const { host, copyText, showToast } = setupHost();
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response('<svg class="a"/>', {
            status: 200,
            headers: { 'content-type': 'image/svg+xml' },
          }),
      ),
    );
    render(
      <HostProvider host={host}>
        <CopyMenu hit={hit} />
      </HostProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'SVG' }));
    await waitFor(() => expect(copyText).toHaveBeenCalledWith('<svg class="a"/>'));
    expect(showToast).toHaveBeenCalledWith('Copied');
  });

  test('JSX button copies JSX-formatted SVG', async () => {
    const user = userEvent.setup();
    const { host, copyText } = setupHost();
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response('<svg class="a"/>', {
            status: 200,
            headers: { 'content-type': 'image/svg+xml' },
          }),
      ),
    );
    render(
      <HostProvider host={host}>
        <CopyMenu hit={hit} />
      </HostProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'JSX' }));
    await waitFor(() => expect(copyText).toHaveBeenCalledWith('<svg className="a"/>'));
  });

  test('Diagram button copies mx from the server', async () => {
    const user = userEvent.setup();
    const { host, copyText } = setupHost();
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response('<mxGraphModel/>', {
            status: 200,
            headers: { 'content-type': 'application/xml' },
          }),
      ),
    );
    render(
      <HostProvider host={host}>
        <CopyMenu hit={hit} />
      </HostProvider>,
    );
    await user.click(screen.getByRole('button', { name: /diagram/i }));
    await waitFor(() => expect(copyText).toHaveBeenCalledWith('<mxGraphModel/>'));
  });

  test('reports failure via toast when fetch fails', async () => {
    const user = userEvent.setup();
    const { host, showToast } = setupHost();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('boom', { status: 500 })),
    );
    render(
      <HostProvider host={host}>
        <CopyMenu hit={hit} />
      </HostProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'SVG' }));
    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Copy failed'));
  });
});
