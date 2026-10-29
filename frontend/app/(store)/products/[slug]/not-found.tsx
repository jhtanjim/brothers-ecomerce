import Link from 'next/link';

export default function ProductNotFound() {
  return (
    <main className="mx-auto max-w-xl px-4 py-24 text-center">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">Product not found</h1>
      <p className="mt-2 text-slate-600">
        This product may have been removed or is no longer available.
      </p>
      <Link
        href="/products"
        className="mt-6 inline-block rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700"
      >
        Browse all products
      </Link>
    </main>
  );
}