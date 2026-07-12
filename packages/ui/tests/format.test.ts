import { describe, expect, test } from 'vitest';
import { svgToJsx, svgToMxLibrary } from '../src/index.ts';

describe('svgToJsx', () => {
  test('renames class to className', () => {
    expect(svgToJsx('<svg class="a"><path/></svg>')).toBe('<svg className="a"><path/></svg>');
  });

  test('renames stroke-width to strokeWidth', () => {
    expect(svgToJsx('<svg><path stroke-width="2"/></svg>')).toContain('strokeWidth="2"');
  });

  test('renames xmlns:xlink to xmlnsXlink', () => {
    expect(svgToJsx('<svg xmlns:xlink="http://a"/>')).toContain('xmlnsXlink="http://a"');
  });

  test('renames fill-rule to fillRule and clip-path to clipPath', () => {
    const out = svgToJsx('<svg><path fill-rule="evenodd" clip-path="url(#x)"/></svg>');
    expect(out).toContain('fillRule="evenodd"');
    expect(out).toContain('clipPath="url(#x)"');
  });
});

describe('svgToMxLibrary', () => {
  test('wraps SVG as mxGraphModel image cell using viewBox size', () => {
    const svg = '<svg viewBox="0 0 32 32"><path d="M0 0"/></svg>';
    const out = svgToMxLibrary(svg);
    expect(out).toContain('<mxGraphModel>');
    expect(out).toContain('width="32"');
    expect(out).toContain('height="32"');
    expect(out).toContain('image=data:image/svg+xml,');
  });

  test('falls back to 100x100 when viewBox is missing', () => {
    const out = svgToMxLibrary('<svg><path/></svg>');
    expect(out).toContain('width="100"');
    expect(out).toContain('height="100"');
  });
});
