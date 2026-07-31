import { describe, expect, it, type Mock, vi } from 'vitest';
import { createExtensionHost } from '../src/host-adapter.ts';

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
    expect(deps.globalState.update).toHaveBeenCalledWith('q', 'home');
    const result = host.handlePersistGet('req-1', 'q');
    // handlePersistGet is synchronous read after set (globalState is in-memory here)
    expect(result).toEqual({ type: 'persistGetResult', requestId: 'req-1', value: 'home' });
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
});
