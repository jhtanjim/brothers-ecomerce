'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CategoryForm } from '@/components/admin/CategoryForm';
import { ErrorState } from '@/components/ui/ErrorState';
import { getAdminCategory } from '@/lib/api/admin-categories';
import { ApiError } from '@/lib/api/client';
import type { AdminCategory } from '@/lib/api/types';

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; category: AdminCategory }
  | { kind: 'missing' }
  | { kind: 'error' };

export function CategoryEditContent({ id }: { id: string }) {
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ kind: 'loading' });
    getAdminCategory(id)
      .then((category) => {
        if (!cancelled) setState({ kind: 'ready', category });
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
      <div className="h-64 max-w-2xl animate-pulse rounded-xl bg-slate-200" aria-busy="true" />
    );
  }
  if (state.kind === 'missing') {
    return (
      <div className="space-y-4">
        <ErrorState title="Category not found" message="It may have been deleted." />
        <Link
          href="/admin/categories"
          className="text-sm font-medium text-brand-600 hover:text-brand-700"
        >
          Back to categories
        </Link>
      </div>
    );
  }
  if (state.kind === 'error') {
    return (
      <div className="space-y-4">
        <ErrorState
          title="Could not load the category"
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
  return <CategoryForm category={state.category} />;
}
