import type { S3Client } from '@aws-sdk/client-s3';
import { describe, expect, test, vi } from 'vitest';
import { R2Client, sha256 } from '../src/r2.ts';

const cfg = {
  accountId: 'acct',
  accessKeyId: 'key',
  secretAccessKey: 'secret',
  bucket: 'icon-collection',
};

describe('sha256', () => {
  test('produces stable hex digest', () => {
    expect(sha256('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  test('handles Buffer input identically', () => {
    expect(sha256(Buffer.from('abc'))).toBe(sha256('abc'));
  });
});

describe('R2Client', () => {
  test('putIfChanged uploads when object is missing and returns changed:true', async () => {
    const send = vi.fn(async (cmd: { constructor: { name: string } }) => {
      if (cmd.constructor.name === 'HeadObjectCommand') {
        throw Object.assign(new Error('not found'), {
          name: 'NotFound',
          $metadata: { httpStatusCode: 404 },
        });
      }
      if (cmd.constructor.name === 'PutObjectCommand') return {};
      return {};
    });
    const client = new R2Client(cfg, { send } as unknown as S3Client);
    const result = await client.putIfChanged('meta/version.json', '{"v":1}');
    expect(result.changed).toBe(true);
    expect(send).toHaveBeenCalledTimes(2);
  });

  test('putIfChanged skips upload when sha256 matches', async () => {
    const digest = sha256('{"v":1}');
    const send = vi.fn(async (cmd: { constructor: { name: string } }) => {
      if (cmd.constructor.name === 'HeadObjectCommand') {
        return { Metadata: { sha256: digest } };
      }
      throw new Error('should not put');
    });
    const client = new R2Client(cfg, { send } as unknown as S3Client);
    const result = await client.putIfChanged('meta/version.json', '{"v":1}');
    expect(result.changed).toBe(false);
    expect(send).toHaveBeenCalledTimes(1);
  });

  test('getJson returns parsed object when the key exists', async () => {
    const send = vi.fn(async (cmd: { constructor: { name: string } }) => {
      if (cmd.constructor.name === 'GetObjectCommand') {
        return {
          Body: {
            transformToString: async (): Promise<string> => '{"hello":"world"}',
          },
        };
      }
      return {};
    });
    const client = new R2Client(cfg, { send } as unknown as S3Client);
    const value = await client.getJson<{ hello: string }>('meta/version.json');
    expect(value).toEqual({ hello: 'world' });
  });

  test('getJson returns null on 404', async () => {
    const send = vi.fn(async () => {
      throw Object.assign(new Error('missing'), {
        name: 'NoSuchKey',
        $metadata: { httpStatusCode: 404 },
      });
    });
    const client = new R2Client(cfg, { send } as unknown as S3Client);
    const value = await client.getJson('meta/version.json');
    expect(value).toBeNull();
  });
});
