export type EmptyStateProps = { variant: 'empty' | 'error' };

export const EmptyState = ({ variant }: EmptyStateProps) => (
  <div class="flex h-full flex-col items-center justify-center gap-1 py-8 text-neutral-500">
    {variant === 'empty' ? (
      <>
        <p class="text-sm">No icons matched.</p>
        <p class="text-xs">Try a different keyword.</p>
      </>
    ) : (
      <>
        <p class="text-sm">Something went wrong.</p>
        <p class="text-xs">Please retry in a moment.</p>
      </>
    )}
  </div>
);
