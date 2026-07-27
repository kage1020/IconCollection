import type { IngestConfig } from './types.ts';

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

export const COLLECTIONS: readonly string[] = [
  'mdi',
  'lucide',
  'heroicons',
  'tabler',
  'bi',
  'fa6-solid',
  'fa6-regular',
  'fa6-brands',
  'material-symbols',
  'carbon',
  'radix-icons',
  'octicon',
  'ph',
  'simple-icons',
  'vscode-icons',
];

const required = (env: Record<string, string | undefined>, key: string): string => {
  const raw = env[key];
  if (typeof raw !== 'string') throw new ConfigError(`missing env var ${key}`);
  const trimmed = raw.trim();
  if (trimmed.length === 0) throw new ConfigError(`missing env var ${key}`);
  return trimmed;
};

export const loadConfig = (env: Record<string, string | undefined>): IngestConfig => {
  const override = env.INGEST_COLLECTIONS?.trim();
  const collections = override
    ? override
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
    : COLLECTIONS;
  return {
    r2: {
      accountId: required(env, 'R2_ACCOUNT_ID'),
      accessKeyId: required(env, 'R2_ACCESS_KEY_ID'),
      secretAccessKey: required(env, 'R2_SECRET_ACCESS_KEY'),
      bucket: required(env, 'R2_BUCKET'),
    },
    d1: {
      apiToken: required(env, 'CLOUDFLARE_API_TOKEN'),
      accountId: required(env, 'CLOUDFLARE_ACCOUNT_ID'),
      databaseId: required(env, 'D1_DATABASE_ID'),
    },
    collections,
    dryRun: env.INGEST_DRY_RUN === '1' || env.INGEST_DRY_RUN === 'true',
  };
};
