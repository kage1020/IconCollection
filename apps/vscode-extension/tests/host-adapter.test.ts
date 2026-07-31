import { describe, expect, it, type Mock, vi } from 'vitest';
import { createExtensionHost, sanitizeApiBaseUrl } from '../src/host-adapter.ts';

// vi.fn() cannot preserve a generic call signature (it collapses `T` to `unknown`),
// so the mock is typed explicitly: Mock<...> for `.mockImplementation()` access in
// tests below, intersected with the real generic signature `createExtensionHost` expects.
type ConfigGet = Mock<(section: string, defaultValue: unknown) => unknown> &
  (<T>(section: string, defaultValue: T) => T);

const makeDeps = () => {
  const store = new Map<string, string>();
  return {
    globalState: {
      get: vi.fn((k: string) => store.get(k) ?? null),
      update: vi.fn(async (k: string, v: string) => {
        store.set(k, v);
      }),
    },
    clipboard: { writeText: vi.fn(async (_s: string) => undefined) },
    ui: { showInformationMessage: vi.fn(), showErrorMessage: vi.fn() },
    config: {
      get: vi.fn((_section: string, defaultValue: unknown) => defaultValue) as ConfigGet,
    },
  };
};

describe('createExtensionHost', () => {
  it('writes clipboard and shows info toast on copyText', async () => {
    const deps = makeDeps();
    const host = createExtensionHost(deps);
    await host.handleCopyText('<svg/>');
    expect(deps.clipboard.writeText).toHaveBeenCalledWith('<svg/>');
    expect(deps.ui.showInformationMessage).toHaveBeenCalledWith('Copied');
  });

  it('showToast routes info by default, error when specified', () => {
    const deps = makeDeps();
    const host = createExtensionHost(deps);
    host.handleShowToast('done');
    host.handleShowToast('boom', 'error');
    expect(deps.ui.showInformationMessage).toHaveBeenCalledWith('done');
    expect(deps.ui.showErrorMessage).toHaveBeenCalledWith('boom');
  });

  it('persist get/set uses globalState', async () => {
    const deps = makeDeps();
    const host = createExtensionHost(deps);
    host.handlePersistSet('q', 'home');
    expect(deps.globalState.update).toHaveBeenCalledWith('webview:q', 'home');
    const result = host.handlePersistGet('req-1', 'q');
    // handlePersistGet is synchronous read after set (globalState is in-memory here)
    expect(result).toEqual({ type: 'persistGetResult', requestId: 'req-1', value: 'home' });
  });

  it('handlePersistGet prefixes the key with "webview:" before reading globalState', () => {
    const deps = makeDeps();
    const host = createExtensionHost(deps);
    host.handlePersistGet('req-1', 'q');
    expect(deps.globalState.get).toHaveBeenCalledWith('webview:q');
  });

  it('handlePersistSet prefixes the key with "webview:" before writing globalState', () => {
    const deps = makeDeps();
    const host = createExtensionHost(deps);
    host.handlePersistSet('q', 'home');
    expect(deps.globalState.update).toHaveBeenCalledWith('webview:q', 'home');
  });

  it('getInitPayload reads settings with defaults', () => {
    const deps = makeDeps();
    deps.config.get.mockImplementation(<T>(section: string, defaultValue: T) => {
      if (section === 'iconCollection.apiBaseUrl') return 'https://custom' as T;
      if (section === 'iconCollection.defaultLimit') return 100 as T;
      return defaultValue;
    });
    const host = createExtensionHost(deps);
    expect(host.getInitPayload()).toEqual({ apiBaseUrl: 'https://custom', defaultLimit: 100 });
  });

  it('getInitPayload falls back to the default apiBaseUrl when the setting is invalid', () => {
    const deps = makeDeps();
    deps.config.get.mockImplementation(<T>(section: string, defaultValue: T) => {
      if (section === 'iconCollection.apiBaseUrl') {
        return 'https://evil.example.com"; script-src *; ' as T;
      }
      return defaultValue;
    });
    const host = createExtensionHost(deps);
    expect(host.getInitPayload().apiBaseUrl).toBe('https://icons.kage1020.com');
  });
});

describe('sanitizeApiBaseUrl', () => {
  it('returns the origin for a valid https URL', () => {
    expect(sanitizeApiBaseUrl('https://icons.kage1020.com')).toBe('https://icons.kage1020.com');
  });

  it('drops path, query, and fragment, keeping only the origin', () => {
    expect(sanitizeApiBaseUrl('https://example.com/foo?bar=baz#frag')).toBe('https://example.com');
  });

  it('preserves a non-default port in the origin', () => {
    expect(sanitizeApiBaseUrl('https://example.com:8443/foo')).toBe('https://example.com:8443');
  });

  it('falls back to the default for a non-https protocol', () => {
    expect(sanitizeApiBaseUrl('http://icons.kage1020.com')).toBe('https://icons.kage1020.com');
    expect(sanitizeApiBaseUrl('data:text/html,<script>alert(1)</script>')).toBe(
      'https://icons.kage1020.com',
    );
    expect(sanitizeApiBaseUrl('javascript:alert(1)')).toBe('https://icons.kage1020.com');
  });

  it('falls back to the default for a malformed URL', () => {
    expect(sanitizeApiBaseUrl('not a url')).toBe('https://icons.kage1020.com');
  });

  it('falls back to the default for an empty string', () => {
    expect(sanitizeApiBaseUrl('')).toBe('https://icons.kage1020.com');
  });

  it('falls back to the default for a CSP/attribute injection attempt', () => {
    expect(sanitizeApiBaseUrl('https://example.com"; script-src *; ')).toBe(
      'https://icons.kage1020.com',
    );
    expect(sanitizeApiBaseUrl('https://example.com<script>')).toBe('https://icons.kage1020.com');
  });
});
