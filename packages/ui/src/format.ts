const HYPHENATED_ATTRS: readonly [RegExp, string][] = [
  [/\bclass=/g, 'className='],
  [/\bstroke-width=/g, 'strokeWidth='],
  [/\bstroke-linecap=/g, 'strokeLinecap='],
  [/\bstroke-linejoin=/g, 'strokeLinejoin='],
  [/\bfill-rule=/g, 'fillRule='],
  [/\bclip-rule=/g, 'clipRule='],
  [/\bclip-path=/g, 'clipPath='],
  [/\bxmlns:xlink=/g, 'xmlnsXlink='],
  [/\bxlink:href=/g, 'xlinkHref='],
];

export const svgToJsx = (svg: string): string => {
  let out = svg;
  for (const [re, replacement] of HYPHENATED_ATTRS) {
    out = out.replace(re, replacement);
  }
  return out;
};

const VIEWBOX_RE = /viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/;

const b64 = (input: string): string => {
  if (typeof btoa === 'function') return btoa(input);
  return Buffer.from(input, 'utf-8').toString('base64');
};

export const svgToMxLibrary = (svg: string): string => {
  const match = svg.match(VIEWBOX_RE);
  const width = match?.[1] ?? '100';
  const height = match?.[2] ?? '100';
  const encoded = b64(svg);
  return `<mxGraphModel><root><mxCell id="0" /><mxCell id="1" parent="0" /><mxCell id="2" style="shape=image;verticalAlign=top;aspect=fixed;imageAspect=0;editableCssRules=.*;image=data:image/svg+xml,${encoded};" vertex="1" parent="1"><mxGeometry x="0" y="0" width="${width}" height="${height}" as="geometry" /></mxCell></root></mxGraphModel>`;
};
