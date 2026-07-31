import * as vscode from 'vscode';
import { createExtensionHost } from './host-adapter';

const VIEW_TYPE = 'iconCollection.IconCollection';

const buildCsp = (nonce: string, apiBaseUrl: string): string =>
  [
    "default-src 'none'",
    `script-src 'nonce-${nonce}'`,
    "style-src 'unsafe-inline'",
    `connect-src ${apiBaseUrl}`,
    `img-src data: ${apiBaseUrl}`,
    'font-src data:',
  ].join('; ');

const makeNonce = (): string => {
  const arr = new Uint8Array(16);
  globalThis.crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
};

const buildHtml = (nonce: string, csp: string, mainJs: vscode.Uri, mainCss: vscode.Uri): string =>
  `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="${csp}" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="stylesheet" href="${mainCss}" />
    <title>Icon Collection</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" nonce="${nonce}" src="${mainJs}"></script>
  </body>
</html>`.trim();

type ReadyMessage = { type: 'ready' };
type CopyTextMessage = { type: 'copyText'; text: string };
type ShowToastMessage = { type: 'showToast'; message: string; severity?: 'info' | 'error' };
type PersistGetMessage = { type: 'persistGet'; requestId: string; key: string };
type PersistSetMessage = { type: 'persistSet'; key: string; value: string };

const hasType = (msg: unknown): msg is { type: unknown } =>
  typeof msg === 'object' && msg !== null && 'type' in msg;

const isReadyMessage = (msg: unknown): msg is ReadyMessage => hasType(msg) && msg.type === 'ready';

const isCopyTextMessage = (msg: unknown): msg is CopyTextMessage =>
  hasType(msg) && msg.type === 'copyText' && typeof (msg as { text?: unknown }).text === 'string';

const isShowToastMessage = (msg: unknown): msg is ShowToastMessage => {
  if (!hasType(msg) || msg.type !== 'showToast') return false;
  const m = msg as { message?: unknown; severity?: unknown };
  if (typeof m.message !== 'string') return false;
  return m.severity === undefined || m.severity === 'info' || m.severity === 'error';
};

const isPersistGetMessage = (msg: unknown): msg is PersistGetMessage => {
  if (!hasType(msg) || msg.type !== 'persistGet') return false;
  const m = msg as { requestId?: unknown; key?: unknown };
  return typeof m.requestId === 'string' && typeof m.key === 'string';
};

const isPersistSetMessage = (msg: unknown): msg is PersistSetMessage => {
  if (!hasType(msg) || msg.type !== 'persistSet') return false;
  const m = msg as { key?: unknown; value?: unknown };
  return typeof m.key === 'string' && typeof m.value === 'string';
};

class IconCollectionProvider implements vscode.WebviewViewProvider {
  constructor(private readonly context: vscode.ExtensionContext) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    const host = createExtensionHost({
      globalState: {
        get: (k) => this.context.globalState.get<string>(k) ?? null,
        update: (k, v) => this.context.globalState.update(k, v),
      },
      clipboard: { writeText: (s) => vscode.env.clipboard.writeText(s) },
      ui: {
        showInformationMessage: (m) => {
          void vscode.window.showInformationMessage(m);
        },
        showErrorMessage: (m) => {
          void vscode.window.showErrorMessage(m);
        },
      },
      config: {
        get: <T>(section: string, defaultValue: T): T => {
          const [ns, key] = section.split('.');
          const cfg = vscode.workspace.getConfiguration(ns);
          return cfg.get<T>(key ?? '', defaultValue);
        },
      },
    });

    const distRoot = vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview');
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [distRoot],
    };

    const mainJs = webviewView.webview.asWebviewUri(vscode.Uri.joinPath(distRoot, 'main.js'));
    const mainCss = webviewView.webview.asWebviewUri(vscode.Uri.joinPath(distRoot, 'main.css'));
    const init = host.getInitPayload();
    const nonce = makeNonce();
    const csp = buildCsp(nonce, init.apiBaseUrl);
    webviewView.webview.html = buildHtml(nonce, csp, mainJs, mainCss);

    webviewView.webview.onDidReceiveMessage((msg: unknown) => {
      if (isReadyMessage(msg)) {
        void webviewView.webview.postMessage({ type: 'init', ...init });
        return;
      }
      if (isCopyTextMessage(msg)) {
        void host.handleCopyText(msg.text);
        return;
      }
      if (isShowToastMessage(msg)) {
        host.handleShowToast(msg.message, msg.severity);
        return;
      }
      if (isPersistGetMessage(msg)) {
        void webviewView.webview.postMessage(host.handlePersistGet(msg.requestId, msg.key));
        return;
      }
      if (isPersistSetMessage(msg)) {
        host.handlePersistSet(msg.key, msg.value);
      }
    });
  }
}

export const activate = (context: vscode.ExtensionContext): void => {
  const provider = new IconCollectionProvider(context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(VIEW_TYPE, provider, {
      webviewOptions: { retainContextWhenHidden: true },
    }),
  );
};

export const deactivate = (): void => undefined;
