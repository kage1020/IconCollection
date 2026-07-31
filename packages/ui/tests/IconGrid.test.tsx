import type { IconHit } from '@icon-collection/core';
import { render, screen } from '@testing-library/preact';
import { describe, expect, test } from 'vitest';
import { HostProvider, IconGrid } from '../src/index.ts';
import { makeHost } from './_helpers.ts';

const hits: IconHit[] = Array.from({ length: 12 }, (_, i) => ({
  collection: 'mdi',
  name: `icon-${i}`,
  license: 'Apache-2.0',
  width: 24,
  height: 24,
}));

describe('IconGrid', () => {
  test('renders every hit', () => {
    render(
      <HostProvider host={makeHost()}>
        <IconGrid hits={hits} columns={4} cellSize={72} />
      </HostProvider>,
    );
    for (const hit of hits) {
      expect(screen.getByRole('button', { name: `mdi/${hit.name}` })).toBeInTheDocument();
    }
  });

  test('renders empty grid without crashing', () => {
    render(
      <HostProvider host={makeHost()}>
        <IconGrid hits={[]} columns={4} cellSize={72} />
      </HostProvider>,
    );
    expect(screen.queryAllByRole('button').length).toBe(0);
  });
});
