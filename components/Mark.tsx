export function Mark({ ticks = false }: { ticks?: boolean }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path
        d="M6 7h20v3.2H12.4v3.4H26v8.2H6V18.6h13.6v-3.2H6V7Z"
        fill="currentColor"
      />
      {ticks ? (
        <path
          className="mark-ticks"
          d="M4 4h3v1H5v2H4V4Zm21 0h3v3h-1V5h-2V4ZM4 25h1v2h2v1H4v-3Zm23 0h1v3h-3v-1h2v-2Z"
        />
      ) : null}
    </svg>
  );
}
