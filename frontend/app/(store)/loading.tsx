export default function HomeLoading() {
  return (
    <div className="mx-auto max-w-7xl animate-pulse px-4 py-8 sm:px-6 lg:px-8" aria-busy="true">
      <div className="h-56 rounded-2xl bg-slate-100 sm:h-72" />
      <div className="mt-10 h-6 w-48 rounded bg-slate-100" />
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 lg:gap-6">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="aspect-[3/4] rounded-xl bg-slate-100" />
        ))}
      </div>
    </div>
  );
}