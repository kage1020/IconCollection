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

  const clear = () => {
    setValue('');
    if (timerRef.current) clearTimeout(timerRef.current);
    onChange('');
  };

  return (
    <div class="group relative">
      <span
        aria-hidden
        class="pointer-events-none absolute inset-y-0 left-4 flex items-center text-neutral-400 group-focus-within:text-sky-500 dark:text-neutral-500"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7"></circle>
          <path d="m20 20-3-3"></path>
        </svg>
      </span>
      <input
        type="search"
        class="block w-full rounded-2xl border border-neutral-200 bg-white/80 py-3.5 pl-12 pr-12 text-base shadow-sm outline-none backdrop-blur transition placeholder:text-neutral-400 focus:border-sky-400 focus:ring-4 focus:ring-sky-100 dark:border-neutral-800 dark:bg-neutral-900/70 dark:placeholder:text-neutral-500 dark:focus:border-sky-500 dark:focus:ring-sky-500/20"
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
      {value ? (
        <button
          type="button"
          aria-label="Clear search"
          onClick={clear}
          class="absolute inset-y-0 right-3 my-auto flex h-8 w-8 items-center justify-center rounded-full text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M18 6 6 18"></path>
            <path d="m6 6 12 12"></path>
          </svg>
        </button>
      ) : null}
    </div>
  );
};
