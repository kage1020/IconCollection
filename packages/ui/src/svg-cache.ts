export type SvgCache = {
  get: (key: string) => string | undefined;
  set: (key: string, value: string) => void;
  has: (key: string) => boolean;
  readonly size: number;
};

export const createSvgCache = (): SvgCache => {
  const store = new Map<string, string>();
  return {
    get: (k) => store.get(k),
    set: (k, v) => {
      store.set(k, v);
    },
    has: (k) => store.has(k),
    get size() {
      return store.size;
    },
  };
};
