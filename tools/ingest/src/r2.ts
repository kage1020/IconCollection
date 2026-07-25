import { createHash } from 'node:crypto';
import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import type { IngestConfig } from './types.ts';

export const sha256 = (input: string | Buffer): string =>
  createHash('sha256').update(input).digest('hex');

const is404 = (err: unknown): boolean => {
  if (typeof err !== 'object' || err === null) return false;
  const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
  return e.name === 'NotFound' || e.name === 'NoSuchKey' || e.$metadata?.httpStatusCode === 404;
};

export class R2Client {
  private readonly s3: S3Client;
  private readonly bucket: string;

  constructor(cfg: IngestConfig['r2'], s3?: S3Client) {
    this.bucket = cfg.bucket;
    this.s3 =
      s3 ??
      new S3Client({
        region: 'auto',
        endpoint: `https://${cfg.accountId}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: cfg.accessKeyId,
          secretAccessKey: cfg.secretAccessKey,
        },
      });
  }

  async putIfChanged(
    key: string,
    body: Buffer | string,
  ): Promise<{ changed: boolean; sha256: string }> {
    const digest = sha256(body);
    try {
      const head = await this.s3.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      if (head.Metadata?.sha256 === digest) return { changed: false, sha256: digest };
    } catch (err) {
      if (!is404(err)) throw err;
    }
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: key.endsWith('.json') ? 'application/json' : 'application/octet-stream',
        Metadata: { sha256: digest },
      }),
    );
    return { changed: true, sha256: digest };
  }

  async putJson<T>(key: string, value: T): Promise<{ changed: boolean; sha256: string }> {
    return this.putIfChanged(key, JSON.stringify(value));
  }

  async getJson<T>(key: string): Promise<T | null> {
    try {
      const out = await this.s3.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
      const body = out.Body as { transformToString: () => Promise<string> } | undefined;
      if (!body) return null;
      const raw = await body.transformToString();
      return JSON.parse(raw) as T;
    } catch (err) {
      if (is404(err)) return null;
      throw err;
    }
  }
}
