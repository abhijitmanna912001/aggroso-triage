export function SignedInBanner() {
  return (
    <p
      role="note"
      className="mb-6 rounded-md border border-amber-700 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-400 dark:bg-amber-950 dark:text-amber-100"
    >
      <span aria-hidden="true">ⓘ </span>
      Choose your name in the header to run an analysis or record decisions.
    </p>
  );
}
