import { createApiClient } from '@icon-collection/core';
import type { Host } from '@icon-collection/ui';
import { createSvgCache } from '@icon-collection/ui';

export type VsCodeApi = {
  postMessage: (msg: unknown) => void;
  getState: () => unknown;
  setState: (state: unknown) => void;
};

export type InitPayload = { apiBaseUrl: string; defaultLimit: number };

export type CreateVscodeHostInput = {
  vscode: VsCodeApi;
  init: InitPayload;
  subscribeToMessages: (handler: (msg: unknown) => void) => () => void;
};

type PersistGetResult = { type: 'persistGetResult'; requestId: string; value: string | null };

const isPersistGetResult = (msg: unknown): msg is PersistGetResult =>
  typeof msg === 'object' &&
  msg !== null &&
  (msg as { type?: unknown }).type === 'persistGetResult' &&
  typeof (msg as { requestId?: unknown }).requestId === 'string';

export const createVscodeHost = (input: CreateVscodeHostInput): Host => {
  const pending = new Map<string, (value: string | null) => void>();
  input.subscribeToMessages((msg) => {
    if (!isPersistGetResult(msg)) return;
    const resolve = pending.get(msg.requestId);
    if (!resolve) return;
    pending.delete(msg.requestId);
    resolve(msg.value);
  });

  let counter = 0;
  const nextRequestId = (): string => `req-${++counter}`;

  return {
    apiBaseUrl: input.init.apiBaseUrl,
    apiClient: createApiClient({ baseUrl: input.init.apiBaseUrl }),
    svgCache: createSvgCache(),
    copyText: async (text) => {
      input.vscode.postMessage({ type: 'copyText', text });
    },
    showToast: (message) => {
      input.vscode.postMessage({ type: 'showToast', message });
    },
    persistState: {
      get: async (key) => {
        const requestId = nextRequestId();
        const promise = new Promise<string | null>((resolve) => pending.set(requestId, resolve));
        input.vscode.postMessage({ type: 'persistGet', requestId, key });
        return promise;
      },
      set: async (key, value) => {
        input.vscode.postMessage({ type: 'persistSet', key, value });
      },
    },
  };
};
