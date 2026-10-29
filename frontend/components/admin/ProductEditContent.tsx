'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ProductForm } from '@/components/admin/ProductForm';
import { ProductImagesManager } from '@/components/admin/ProductImagesManager';
import { ErrorState } from '@/components/ui/ErrorState';
import { getAdminProduct } from '@/lib/api/admin-products';
import { ApiError } from '@/lib/api/client';
import type { AdminProduct } from '@/lib/api/types';

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; product: AdminProduct }
  | { kind: 'missing' }
  | { kind: 'error' };

export function ProductEditContent({ id, created }: { id: string; created: boolean }) {
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ kind: 'loading' });
    getAdminProduct(id)
      .then((product) => {
        if (!cancelled) setState({ kind: 'ready', product });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setState(
          err instanceof ApiError && err.status === 404 ? { kind: 'missing' } : { kind: 'error' },
        );
      });
    return () => {
      cancelled = true;
    };
  }, [id, attempt]);

  if (state.kind === 'loading') {
    return (
      <div className="h-64 max-w-3xl animate-pulse rounded-xl bg-slate-200" aria-busy="true" />
    );
  }
  if (state.kind === 'missing') {
    return (
      <div className="space-y-4">
        <ErrorState title="Product not found" message="It may have been deleted." />
        <Link
          href="/admin/products"
          className="text-sm font-medium text-brand-600 hover:text-brand-700"
        >
          Back to products
        </Link>
      </div>
    );
  }
  if (state.kind === 'error') {
    return (
      <div className="space-y-4">
        <ErrorState
          title="Could not load the product"
          message="Please check your connection and try again."
        />
        <button
          type="button"
          onClick={() => setAttempt((count) => count + 1)}
          className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          Try again
        </button>
      </div>
    );
  }

  const { product } = state;
  const update = (next: AdminProduct) => setState({ kind: 'ready', product: next });
  return (
    <div className="space-y-6">
      {created ? (
        <p
          role="status"
          className="max-w-3xl rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
        >
          Product created. Add images below
          {product.status === 'ACTIVE' ? '; it is already visible in the store.' : '.'}
        </p>
      ) : null}
      <p className="text-sm text-slate-600">
        Status: <span className="font-medium text-slate-900">{product.status.toLowerCase()}</span>{' '}
        (change it from the{' '}
        <Link href="/admin/products" className="font-medium text-brand-600 hover:text-brand-700">
          product list
        </Link>
        ).{' '}
        {product.status === 'ACTIVE' && product.category.status === 'ACTIVE' ? (
          <Link
            href={`/products/${encodeURIComponent(product.slug)}`}
            className="font-medium text-brand-600 hover:text-brand-700"
          >
            View in store
          </Link>
        ) : null}
      </p>
      <ProductImagesManager product={product} onChange={update} />
      {/* key: a fresh form after an image change would discard typing, so key only on id. */}
      <ProductForm key={product.id} product={product} onSaved={update} />
    </div>
  );
}
