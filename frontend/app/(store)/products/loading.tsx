export default function ProductsLoading() {
  return (
    <div className="mx-auto max-w-7xl animate-pulse px-4 py-8 sm:px-6 lg:px-8" aria-busy="true">
      <div className="h-8 w-56 rounded bg-slate-100" />
      <div className="mt-2 h-4 w-24 rounded bg-slate-100" />
      <div className="mt-6 h-40 rounded-xl bg-slate-100 sm:h-32" />
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 lg:gap-6">
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} className="aspect-[3/4] rounded-xl bg-slate-100" />
        ))}
      </div>
    </div>
  );
}
