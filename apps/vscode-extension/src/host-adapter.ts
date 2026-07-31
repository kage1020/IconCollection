export type ExtensionHostDeps = {
  globalState: {
    get: (key: string) => string | null | undefined;
    update: (key: string, value: string) => Thenable<void>;
  };
  clipboard: { writeText: (s: string) => Thenable<void> };
  ui: {
    showInformationMessage: (m: string) => void;
    showErrorMessage: (m: string) => void;
  };
  config: {
    get: <T>(section: string, defaultValue: T) => T;
  };
};

export type PersistGetResult = {
  type: 'persistGetResult';
  requestId: string;
  value: string | null;
};

const DEFAULT_API_BASE_URL = 'https://icons.kage1020.com';

// Characters that could break out of the CSP `<meta content="...">` attribute
// or inject additional CSP directives. Rejected even if `new URL()` would
// tolerate a URL-encoded equivalent, since we require the raw setting to be clean.
const FORBIDDEN_CHARS = /[\s;<>"']/;

/**
 * Validates a workspace-supplied API base URL before it is ever interpolated
 * into the WebView's CSP or used for network egress. Only a bare
 * `https://host[:port]` origin (no path/query/fragment, no CSP-hostile
 * characters) is accepted; anything else falls back to the built-in default.
 */
export const sanitizeApiBaseUrl = (raw: string): string => {
  if (FORBIDDEN_CHARS.test(raw)) return DEFAULT_API_BASE_URL;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:') return DEFAULT_API_BASE_URL;
    if (FORBIDDEN_CHARS.test(url.origin)) return DEFAULT_API_BASE_URL;
    return url.origin;
  } catch {
    return DEFAULT_API_BASE_URL;
  }
};

const WEBVIEW_KEY_PREFIX = 'webview:';

export type ExtensionHost = {
  handleCopyText: (text: string) => Promise<void>;
  handleShowToast: (message: string, severity?: 'info' | 'error') => void;
  handlePersistGet: (requestId: string, key: string) => PersistGetResult;
  handlePersistSet: (key: string, value: string) => void;
  getInitPayload: () => { apiBaseUrl: string; defaultLimit: number };
};

export const createExtensionHost = (deps: ExtensionHostDeps): ExtensionHost => ({
  handleCopyText: async (text) => {
    await deps.clipboard.writeText(text);
    deps.ui.showInformationMessage('Copied');
  },
  handleShowToast: (message, severity) => {
    if (severity === 'error') deps.ui.showErrorMessage(message);
    else deps.ui.showInformationMessage(message);
  },
  handlePersistGet: (requestId, key) => ({
    type: 'persistGetResult',
    requestId,
    value: deps.globalState.get(WEBVIEW_KEY_PREFIX + key) ?? null,
  }),
  handlePersistSet: (key, value) => {
    void deps.globalState.update(WEBVIEW_KEY_PREFIX + key, value);
  },
  getInitPayload: () => ({
    apiBaseUrl: sanitizeApiBaseUrl(
      deps.config.get('iconCollection.apiBaseUrl', DEFAULT_API_BASE_URL),
    ),
    defaultLimit: deps.config.get('iconCollection.defaultLimit', 60),
  }),
});
