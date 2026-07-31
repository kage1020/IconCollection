import { describe, expect, it, vi } from 'vitest';
import { createVscodeHost } from '../src/webview/vscode-host.ts';

const makeVscode = () => ({ postMessage: vi.fn(), getState: () => null, setState: vi.fn() });

describe('createVscodeHost', () => {
  it('routes copyText through postMessage', async () => {
    const vscode = makeVscode();
    const host = createVscodeHost({
      vscode,
      init: { apiBaseUrl: 'https://x.test', defaultLimit: 60 },
      subscribeToMessages: () => () => undefined,
    });
    await host.copyText('<svg/>');
    expect(vscode.postMessage).toHaveBeenCalledWith({ type: 'copyText', text: '<svg/>' });
  });

  it('routes showToast through postMessage', () => {
    const vscode = makeVscode();
    const host = createVscodeHost({
      vscode,
      init: { apiBaseUrl: 'https://x.test', defaultLimit: 60 },
      subscribeToMessages: () => () => undefined,
    });
    host.showToast('Copied');
    expect(vscode.postMessage).toHaveBeenCalledWith({ type: 'showToast', message: 'Copied' });
  });

  it('resolves persistState.get from inbound persistGetResult message', async () => {
    const vscode = makeVscode();
    let handler: ((msg: unknown) => void) = () => {};
    const host = createVscodeHost({
      vscode,
      init: { apiBaseUrl: 'https://x.test', defaultLimit: 60 },
      subscribeToMessages: (h) => {
        handler = h;
        return () => undefined;
      },
    });
    const pending = host.persistState.get('theQuery');
    expect(vscode.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'persistGet', key: 'theQuery' }),
    );
    const call = vscode.postMessage.mock.calls[0]?.[0] as { requestId: string };
    handler({ type: 'persistGetResult', requestId: call.requestId, value: 'stored' });
    expect(await pending).toBe('stored');
  });

  it('sends persistSet immediately', async () => {
    const vscode = makeVscode();
    const host = createVscodeHost({
      vscode,
      init: { apiBaseUrl: 'https://x.test', defaultLimit: 60 },
      subscribeToMessages: () => () => undefined,
    });
    await host.persistState.set('lastQ', 'home');
    expect(vscode.postMessage).toHaveBeenCalledWith({
      type: 'persistSet',
      key: 'lastQ',
      value: 'home',
    });
  });

  it('exposes apiBaseUrl and constructs apiClient / svgCache', () => {
    const vscode = makeVscode();
    const host = createVscodeHost({
      vscode,
      init: { apiBaseUrl: 'https://x.test', defaultLimit: 60 },
      subscribeToMessages: () => () => undefined,
    });
    expect(host.apiBaseUrl).toBe('https://x.test');
    expect(typeof host.apiClient.search).toBe('function');
    expect(host.svgCache.size).toBe(0);
  });
});
