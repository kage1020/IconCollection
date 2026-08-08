export type EmptyStateProps = { variant: 'empty' | 'error' | 'idle' };

const SearchIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="32"
    height="32"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.5"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <circle cx="11" cy="11" r="7"></circle>
    <path d="m20 20-3-3"></path>
  </svg>
);

const AlertIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="32"
    height="32"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.5"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d="M12 9v4"></path>
    <path d="M12 17h.01"></path>
    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
  </svg>
);

export const EmptyState = ({ variant }: EmptyStateProps) => (
  <div class="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-neutral-300 bg-white/50 py-16 text-center text-neutral-500 dark:border-neutral-700 dark:bg-neutral-900/40 dark:text-neutral-400">
    <div class="mb-1 flex h-14 w-14 items-center justify-center rounded-full bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
      {variant === 'error' ? <AlertIcon /> : <SearchIcon />}
    </div>
    {variant === 'empty' ? (
      <>
        <p class="text-sm font-medium text-neutral-700 dark:text-neutral-200">No icons matched.</p>
        <p class="text-xs">Try a different keyword.</p>
      </>
    ) : variant === 'error' ? (
      <>
        <p class="text-sm font-medium text-neutral-700 dark:text-neutral-200">
          Something went wrong.
        </p>
        <p class="text-xs">Please retry in a moment.</p>
      </>
    ) : (
      <>
        <p class="text-sm font-medium text-neutral-700 dark:text-neutral-200">
          Search across 55,000+ icons.
        </p>
        <p class="text-xs">MDI, Lucide, Heroicons, Tabler and more.</p>
      </>
    )}
  </div>
);
