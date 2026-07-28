import { render, screen, waitFor } from '@testing-library/preact';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { SearchPage } from '../../src/islands/SearchPage.tsx';

it('renders results after user types a query', async () => {
  const fetchImpl = vi.fn(async (input: URL | RequestInfo) => {
    const url = input.toString();
    if (url.includes('/api/search')) {
      return new Response(
        JSON.stringify({
          hits: [{ collection: 'mdi', name: 'home', license: 'Apache-2.0', width: 24, height: 24 }],
          total: 1,
          cursor: null,
        }),
      );
    }
    return new Response('<svg/>', { headers: { 'content-type': 'image/svg+xml' } });
  });
  globalThis.fetch = fetchImpl as unknown as typeof fetch;

  render(<SearchPage apiBaseUrl="" />);
  await userEvent.type(screen.getByRole('searchbox'), 'home');
  await waitFor(() => expect(screen.getByLabelText('mdi/home')).toBeInTheDocument());
});
