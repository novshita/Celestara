export function PageHeading({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="flex flex-col gap-2">
      <h1 className="display text-3xl font-semibold tracking-tight text-amber-300">{title}</h1>
      {children && <p className="text-slate-400">{children}</p>}
    </header>
  );
}
