import type { IconifyJSON } from '@iconify/types';

const memory = new Map<string, IconifyJSON>();

export const loadCollection = async (
  env: { ICONS: R2Bucket },
  collection: string,
): Promise<IconifyJSON | null> => {
  const cached = memory.get(collection);
  if (cached) return cached;
  const obj = await env.ICONS.get(`iconify/${collection}.json`);
  if (!obj) return null;
  const json = (await obj.json()) as IconifyJSON;
  memory.set(collection, json);
  return json;
};

const UNSAFE = /<script\b|<foreignObject\b|\son[a-z]+\s*=/i;

export const isUnsafeSvg = (body: string): boolean => UNSAFE.test(body);

export const hashSha256 = async (input: string): Promise<string> => {
  const buf = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', buf);
  const hex = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return hex.slice(0, 8);
};
