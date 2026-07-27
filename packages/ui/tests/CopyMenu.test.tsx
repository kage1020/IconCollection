import type { IconHit } from '@icon-collection/core';
import { render, screen, waitFor } from '@testing-library/preact';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { CopyMenu, HostProvider } from '../src/index.ts';
import { makeHost } from './_helpers.ts';

const hit: IconHit = {
  collection: 'mdi',
  name: 'home',
  license: 'Apache-2.0',
  width: 24,
  height: 24,
};

describe('CopyMenu', () => {
  test('SVG button copies raw SVG', async () => {
    const user = userEvent.setup();
    const copyText = vi.fn(async () => {});
    const showToast = vi.fn();
    const getSvg = vi.fn(async () => '<svg class="a"/>');
    const host = makeHost({ copyText, showToast, apiClient: { getSvg } });
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
    const copyText = vi.fn(async () => {});
    const getSvg = vi.fn(async () => '<svg class="a"/>');
    const host = makeHost({ copyText, apiClient: { getSvg } });
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
    const copyText = vi.fn(async () => {});
    const getMx = vi.fn(async () => '<mxGraphModel/>');
    const host = makeHost({ copyText, apiClient: { getMx } });
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
    const showToast = vi.fn();
    const getSvg = vi.fn(async () => {
      throw new Error('boom');
    });
    const host = makeHost({ showToast, apiClient: { getSvg } });
    render(
      <HostProvider host={host}>
        <CopyMenu hit={hit} />
      </HostProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'SVG' }));
    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Copy failed: boom'));
  });
});
