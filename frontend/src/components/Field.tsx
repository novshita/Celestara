/**
 * Label + input/select + optional hint/error, shared by every form in the
 * app (birth data, profile, journal). Originated in `BirthFieldsFieldset`;
 * moved here once a second form (journal) needed it too, rather than
 * importing a generic helper from a file with "Birth" in its name.
 */
export function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm text-slate-300">
      <span>{label}</span>
      {children}
      {hint && !error && <span className="text-xs text-slate-500">{hint}</span>}
      {error && <span className="text-xs text-red-400">{error}</span>}
    </label>
  );
}
