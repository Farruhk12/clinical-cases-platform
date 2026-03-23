export function PageLoader() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 py-24 motion-safe:animate-fade-in">
      <div
        className="h-11 w-11 rounded-full border-2 border-brand-200 border-t-brand-500 motion-safe:animate-[spin_0.85s_linear_infinite]"
        aria-hidden
      />
      <p className="text-sm font-medium text-slate-600">Загрузка…</p>
    </div>
  );
}
