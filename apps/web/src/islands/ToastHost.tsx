import { useEffect, useState } from 'preact/hooks';

type ToastItem = { id: number; text: string };

let externalPush: ((m: string) => void) | null = null;

export const pushToast = (m: string): void => externalPush?.(m);

export const ToastHost = () => {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    externalPush = (text) => {
      const id = Date.now() + Math.random();
      setItems((prev) => [...prev, { id, text }]);
      setTimeout(() => setItems((prev) => prev.filter((i) => i.id !== id)), 10_000);
    };
    return () => {
      externalPush = null;
    };
  }, []);

  return (
    <div class="pointer-events-none fixed inset-x-0 bottom-4 flex flex-col items-center gap-2">
      {items.map((i) => (
        <div
          key={i.id}
          class="pointer-events-auto rounded bg-neutral-900 px-3 py-1.5 text-sm text-white shadow"
        >
          {i.text}
        </div>
      ))}
    </div>
  );
};
