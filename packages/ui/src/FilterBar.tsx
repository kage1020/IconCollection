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

export const FilterBar = ({ collections, licenses, value, onChange }: FilterBarProps) => (
  <div class="flex flex-wrap items-center gap-3 text-xs">
    <fieldset class="flex flex-wrap items-center gap-2">
      <legend class="mr-1 font-semibold">Collection</legend>
      {collections.map((c) => (
        <label key={c.name} class="inline-flex items-center gap-1">
          <input
            type="checkbox"
            checked={value.collection.includes(c.name)}
            onChange={() => onChange({ ...value, collection: toggle(value.collection, c.name) })}
          />
          <span>{c.label}</span>
        </label>
      ))}
    </fieldset>
    <fieldset class="flex flex-wrap items-center gap-2">
      <legend class="mr-1 font-semibold">License</legend>
      {licenses.map((l) => (
        <label key={l} class="inline-flex items-center gap-1">
          <input
            type="checkbox"
            checked={value.license.includes(l)}
            onChange={() => onChange({ ...value, license: toggle(value.license, l) })}
          />
          <span>{l}</span>
        </label>
      ))}
    </fieldset>
    <button
      type="button"
      class="ml-auto rounded border border-neutral-300 px-2 py-1"
      onClick={() => onChange({ collection: [], license: [] })}
    >
      Clear
    </button>
  </div>
);
