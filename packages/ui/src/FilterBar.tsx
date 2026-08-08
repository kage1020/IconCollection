export type FilterValue = {
  collection: string[];
  license: string[];
};

export type FilterOption = { name: string; label: string };

export type FilterBarProps = {
  collections: readonly FilterOption[];
  licenses: readonly string[];
  value: FilterValue;
  onChange: (next: FilterValue) => void;
};

const toggle = (arr: readonly string[], name: string): string[] =>
  arr.includes(name) ? arr.filter((v) => v !== name) : [...arr, name];

// Pill-shaped chip: the real <input> stays in the accessibility tree (visually
// hidden but still keyboard-reachable) and the sibling <span> paints the chip.
// peer-checked + peer-focus-visible drive the visual state so we keep the
// native semantics rather than mimicking them with role="button".
const chipInput = 'peer sr-only';
const chipLabel =
  'inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-medium text-neutral-600 shadow-sm transition hover:border-neutral-300 hover:text-neutral-900 peer-checked:border-sky-500 peer-checked:bg-sky-500 peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-sky-300 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:border-neutral-700 dark:hover:text-neutral-100 dark:peer-focus-visible:ring-offset-neutral-950';

export const FilterBar = ({ collections, licenses, value, onChange }: FilterBarProps) => {
  const activeCount = value.collection.length + value.license.length;
  return (
    <div class="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white/70 p-4 shadow-sm backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/60">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M3 6h18"></path>
            <path d="M7 12h10"></path>
            <path d="M10 18h4"></path>
          </svg>
          <span>Filters</span>
          {activeCount > 0 ? (
            <span class="rounded-full bg-sky-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
              {activeCount}
            </span>
          ) : null}
        </div>
        <button
          type="button"
          class="rounded-full border border-transparent px-2 py-1 text-xs text-neutral-500 transition hover:border-neutral-200 hover:text-neutral-900 dark:hover:border-neutral-700 dark:hover:text-neutral-100 disabled:cursor-not-allowed disabled:opacity-40"
          onClick={() => onChange({ collection: [], license: [] })}
          disabled={activeCount === 0}
        >
          Clear
        </button>
      </div>

      <fieldset class="flex flex-wrap items-center gap-2">
        <legend class="mb-1.5 mr-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
          Collection
        </legend>
        {collections.map((c) => (
          <label key={c.name} class="inline-flex">
            <input
              type="checkbox"
              class={chipInput}
              checked={value.collection.includes(c.name)}
              onChange={() => onChange({ ...value, collection: toggle(value.collection, c.name) })}
              aria-label={c.label}
            />
            <span class={chipLabel}>{c.label}</span>
          </label>
        ))}
      </fieldset>

      <fieldset class="flex flex-wrap items-center gap-2">
        <legend class="mb-1.5 mr-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
          License
        </legend>
        {licenses.map((l) => (
          <label key={l} class="inline-flex">
            <input
              type="checkbox"
              class={chipInput}
              checked={value.license.includes(l)}
              onChange={() => onChange({ ...value, license: toggle(value.license, l) })}
              aria-label={l}
            />
            <span class={chipLabel}>{l}</span>
          </label>
        ))}
      </fieldset>
    </div>
  );
};
