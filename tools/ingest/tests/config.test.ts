import { describe, expect, test } from 'vitest';
import { COLLECTIONS, ConfigError, loadConfig } from '../src/config.ts';

const fullEnv = {
  R2_ACCOUNT_ID: 'acct',
  R2_ACCESS_KEY_ID: 'keyid',
  R2_SECRET_ACCESS_KEY: 'secret',
  R2_BUCKET: 'icon-collection',
  CLOUDFLARE_API_TOKEN: 'tok',
  CLOUDFLARE_ACCOUNT_ID: 'cf-acct',
  D1_DATABASE_ID: 'db',
};

describe('COLLECTIONS', () => {
  test('has 15 fixed collections including mdi and lucide', () => {
    expect(COLLECTIONS.length).toBe(15);
    expect(COLLECTIONS).toContain('mdi');
    expect(COLLECTIONS).toContain('lucide');
    expect(COLLECTIONS).toContain('heroicons');
    expect(COLLECTIONS).toContain('material-symbols');
    expect(COLLECTIONS).toContain('simple-icons');
  });
});

describe('loadConfig', () => {
  test('returns IngestConfig with all fields', () => {
    const cfg = loadConfig(fullEnv);
    expect(cfg.r2.accountId).toBe('acct');
    expect(cfg.r2.bucket).toBe('icon-collection');
    expect(cfg.d1.databaseId).toBe('db');
    expect(cfg.dryRun).toBe(false);
    expect(cfg.collections).toBe(COLLECTIONS);
  });

  test('supports INGEST_DRY_RUN=1 to enable dryRun', () => {
    const cfg = loadConfig({ ...fullEnv, INGEST_DRY_RUN: '1' });
    expect(cfg.dryRun).toBe(true);
  });

  test('supports INGEST_COLLECTIONS to override the collection list', () => {
    const cfg = loadConfig({ ...fullEnv, INGEST_COLLECTIONS: 'mdi,lucide' });
    expect(cfg.collections).toEqual(['mdi', 'lucide']);
  });

  test('throws ConfigError when R2_ACCOUNT_ID is missing', () => {
    const env = { ...fullEnv } as Record<string, string | undefined>;
    delete env.R2_ACCOUNT_ID;
    expect(() => loadConfig(env)).toThrow(ConfigError);
    expect(() => loadConfig(env)).toThrow(/R2_ACCOUNT_ID/);
  });

  test('throws ConfigError when CLOUDFLARE_API_TOKEN is missing', () => {
    const env = { ...fullEnv } as Record<string, string | undefined>;
    delete env.CLOUDFLARE_API_TOKEN;
    expect(() => loadConfig(env)).toThrow(/CLOUDFLARE_API_TOKEN/);
  });

  test('trims whitespace from env values', () => {
    const cfg = loadConfig({ ...fullEnv, R2_BUCKET: '  icon-collection  ' });
    expect(cfg.r2.bucket).toBe('icon-collection');
  });
});
