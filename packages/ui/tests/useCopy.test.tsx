import { act, renderHook } from '@testing-library/preact';
import type { ComponentChildren } from 'preact';
import { describe, expect, it, vi } from 'vitest';
import { HostProvider, useCopy } from '../src/index.ts';
import { makeHost } from './_helpers.ts';

describe('useCopy', () => {
  it('surfaces error message to showToast on failure', async () => {
    const showToast = vi.fn();
    const host = makeHost({
      showToast,
      apiClient: {
        search: async () => ({ hits: [], total: 0, cursor: null }),
        getSvg: async () => {
          throw new Error('boom');
        },
        getMx: async () => '',
      },
    });
    const wrapper = ({ children }: { children: ComponentChildren }) => (
      <HostProvider host={host}>{children}</HostProvider>
    );
    const { result } = renderHook(() => useCopy(), { wrapper });
    await act(async () => {
      await result.current('svg', {
        collection: 'mdi',
        name: 'home',
        license: 'Apache-2.0',
        width: 24,
        height: 24,
      });
    });
    expect(showToast).toHaveBeenCalledWith('Copy failed: boom');
  });
});
