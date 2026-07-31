import { render } from 'preact';
import { SearchPage } from './SearchPage.tsx';
import { createVscodeHost, type InitPayload, type VsCodeApi } from './vscode-host.ts';
import './main.css';

declare global {
  interface Window {
    acquireVsCodeApi: () => VsCodeApi;
  }
}

const vscode = window.acquireVsCodeApi();
const messageHandlers = new Set<(msg: unknown) => void>();
window.addEventListener('message', (event) => {
  for (const handler of messageHandlers) handler(event.data);
});

const initReady = new Promise<InitPayload>((resolve) => {
  const initHandler = (msg: unknown): void => {
    if (typeof msg === 'object' && msg !== null && (msg as { type?: unknown }).type === 'init') {
      messageHandlers.delete(initHandler);
      resolve(msg as InitPayload & { type: 'init' });
    }
  };
  messageHandlers.add(initHandler);
});

vscode.postMessage({ type: 'ready' });

initReady.then((init) => {
  const host = createVscodeHost({
    vscode,
    init,
    subscribeToMessages: (handler) => {
      messageHandlers.add(handler);
      return () => {
        messageHandlers.delete(handler);
      };
    },
  });
  const root = document.getElementById('root');
  if (!root) throw new Error('#root not found');
  render(<SearchPage host={host} defaultLimit={init.defaultLimit} />, root);
});
