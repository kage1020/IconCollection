import { render, screen } from '@testing-library/preact';
import { describe, expect, test, vi } from 'vitest';
import { HostProvider, useHost } from '../src/index.ts';
import { makeHost } from './_helpers.ts';

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
    expect(screen.getByTestId('url').textContent).toBe('https://example.test');
  });

  test('throws when useHost is called outside provider', () => {
    // suppress preact console error for the throw
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow(/HostProvider/);
    spy.mockRestore();
  });
});
