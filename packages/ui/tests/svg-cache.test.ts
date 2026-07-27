import { describe, expect, it } from 'vitest';
import { createSvgCache } from '../src/svg-cache.ts';

describe('createSvgCache', () => {
  it('stores and retrieves values by key', () => {
    const c = createSvgCache();
    expect(c.has('a')).toBe(false);
    c.set('a', '<svg />');
    expect(c.get('a')).toBe('<svg />');
    expect(c.has('a')).toBe(true);
    expect(c.size).toBe(1);
  });

  it('is isolated between instances', () => {
    const a = createSvgCache();
    const b = createSvgCache();
    a.set('x', 'X');
    expect(b.get('x')).toBeUndefined();
  });
});
