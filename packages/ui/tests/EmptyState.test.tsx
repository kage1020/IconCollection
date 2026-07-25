import { render, screen } from '@testing-library/preact';
import { describe, expect, test } from 'vitest';
import { EmptyState } from '../src/index.ts';

describe('EmptyState', () => {
  test('shows an empty message', () => {
    render(<EmptyState variant="empty" />);
    expect(screen.getByText(/no icons/i)).toBeInTheDocument();
  });

  test('shows an error message', () => {
    render(<EmptyState variant="error" />);
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
  });
});
