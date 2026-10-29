export default function ProductDetailLoading() {
  return (
    <div className="mx-auto max-w-7xl animate-pulse px-4 py-8 sm:px-6 lg:px-8" aria-busy="true">
      <div className="h-4 w-64 rounded bg-slate-100" />
      <div className="mt-6 grid gap-8 lg:grid-cols-2 lg:gap-12">
        <div className="aspect-square rounded-xl bg-slate-100" />
        <div className="space-y-4">
          <div className="h-8 w-3/4 rounded bg-slate-100" />
          <div className="h-6 w-32 rounded bg-slate-100" />
          <div className="h-24 rounded bg-slate-100" />
        </div>
      </div>
    </div>
  );
}