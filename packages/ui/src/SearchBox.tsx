import { useEffect, useRef, useState } from 'preact/hooks';

export type SearchBoxProps = {
  initialValue?: string;
  onChange: (value: string) => void;
  debounceMs?: number;
  placeholder?: string;
};

export const SearchBox = ({
  initialValue = '',
  onChange,
  debounceMs = 150,
  placeholder,
}: SearchBoxProps) => {
  const [value, setValue] = useState(initialValue);
  const composingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const scheduleChange = (next: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (composingRef.current) return;
    timerRef.current = setTimeout(() => onChange(next), debounceMs);
  };

  return (
    <input
      type="search"
      class="w-full rounded border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
      value={value}
      placeholder={placeholder}
      onInput={(e) => {
        const next = (e.currentTarget as HTMLInputElement).value;
        setValue(next);
        scheduleChange(next);
      }}
      onCompositionStart={() => {
        composingRef.current = true;
        if (timerRef.current) clearTimeout(timerRef.current);
      }}
      onCompositionEnd={(e) => {
        composingRef.current = false;
        const next = (e.currentTarget as HTMLInputElement).value;
        setValue(next);
        scheduleChange(next);
      }}
    />
  );
};
