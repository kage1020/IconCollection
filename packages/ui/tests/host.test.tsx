import { render, screen } from '@testing-library/preact';
import { describe, expect, test, vi } from 'vitest';
import type { Host } from '../src/index.ts';
import { createSvgCache, HostProvider, useHost } from '../src/index.ts';

const makeHost = (): Host => ({
  apiBaseUrl: 'https://x.example',
  copyText: vi.fn(async () => {}),
  showToast: vi.fn(),
  persistState: {
    get: vi.fn(async () => null),
    set: vi.fn(async () => {}),
  },
  svgCache: createSvgCache(),
});

const Probe = () => {
  const host = useHost();
  return <span data-testid="url">{host.apiBaseUrl}</span>;
};

describe('HostProvider / useHost', () => {
  test('supplies host to descendants', () => {
    render(
      <HostProvider host={makeHost()}>
        <Probe />
      </HostProvider>,
    );
    expect(screen.getByTestId('url').textContent).toBe('https://x.example');
  });

  test('throws when useHost is called outside provider', () => {
    // suppress preact console error for the throw
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow(/HostProvider/);
    spy.mockRestore();
  });
});
