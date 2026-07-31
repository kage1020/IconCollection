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
    value: deps.globalState.get(key) ?? null,
  }),
  handlePersistSet: (key, value) => {
    void deps.globalState.update(key, value);
  },
  getInitPayload: () => ({
    apiBaseUrl: deps.config.get('iconCollection.apiBaseUrl', 'https://icons.kage1020.com'),
    defaultLimit: deps.config.get('iconCollection.defaultLimit', 60),
  }),
});
