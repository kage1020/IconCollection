import { render, screen } from '@testing-library/preact';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import type { FilterValue } from '../src/index.ts';
import { FilterBar } from '../src/index.ts';

const collections = [
  { name: 'mdi', label: 'Material' },
  { name: 'lucide', label: 'Lucide' },
];
const licenses = ['MIT', 'Apache-2.0'];

describe('FilterBar', () => {
  test('renders provided collections and licenses', () => {
    const value: FilterValue = { collection: [], license: [] };
    render(
      <FilterBar collections={collections} licenses={licenses} value={value} onChange={() => {}} />,
    );
    expect(screen.getByRole('checkbox', { name: 'Material' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'MIT' })).toBeInTheDocument();
  });

  test('toggles a collection selection', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const value: FilterValue = { collection: [], license: [] };
    render(
      <FilterBar collections={collections} licenses={licenses} value={value} onChange={onChange} />,
    );
    await user.click(screen.getByRole('checkbox', { name: 'Material' }));
    expect(onChange).toHaveBeenLastCalledWith({ collection: ['mdi'], license: [] });
  });

  test('deselects a collection when clicked again', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const value: FilterValue = { collection: ['mdi'], license: [] };
    render(
      <FilterBar collections={collections} licenses={licenses} value={value} onChange={onChange} />,
    );
    await user.click(screen.getByRole('checkbox', { name: 'Material' }));
    expect(onChange).toHaveBeenLastCalledWith({ collection: [], license: [] });
  });

  test('clear button empties all filters', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const value: FilterValue = { collection: ['mdi'], license: ['MIT'] };
    render(
      <FilterBar collections={collections} licenses={licenses} value={value} onChange={onChange} />,
    );
    await user.click(screen.getByRole('button', { name: /clear/i }));
    expect(onChange).toHaveBeenLastCalledWith({ collection: [], license: [] });
  });
});
