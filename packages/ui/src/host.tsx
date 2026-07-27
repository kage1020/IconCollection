import type { ComponentChildren } from 'preact';
import { createContext } from 'preact';
import { useContext } from 'preact/hooks';
import type { SvgCache } from './svg-cache.ts';

export type { SvgCache };

export type Host = {
  apiBaseUrl: string;
  copyText: (s: string) => Promise<void>;
  showToast: (m: string) => void;
  persistState: {
    get: (k: string) => Promise<string | null>;
    set: (k: string, v: string) => Promise<void>;
  };
  svgCache: SvgCache;
};

const HostContext = createContext<Host | null>(null);

export type HostProviderProps = {
  host: Host;
  children: ComponentChildren;
};

export const HostProvider = ({ host, children }: HostProviderProps) => (
  <HostContext.Provider value={host}>{children}</HostContext.Provider>
);

export const useHost = (): Host => {
  const host = useContext(HostContext);
  if (!host) throw new Error('useHost must be called inside HostProvider');
  return host;
};
