'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { AuthFormField } from '@/components/auth/AuthFormField';
import { ApiError } from '@/lib/api/client';
import { safeNextPath } from '@/lib/safe-redirect';

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNextPath(searchParams.get('next'));
  const { status, login } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Already signed in: nothing to do here.
  useEffect(() => {
    if (status === 'authenticated') router.replace(next);
  }, [status, next, router]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError(null);
    setSubmitting(true);
    try {
      await login({
        email: String(form.get('email') ?? '').trim(),
        password: String(form.get('password') ?? ''),
      });
      router.replace(next);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiError && err.status !== 0
          ? err.message
          : 'Unable to sign in right now. Please try again.',
      );
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      <AuthFormField label="Email" name="email" type="email" autoComplete="email" required />
      <AuthFormField
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
      />
      <p className="-mt-2 text-right text-sm">
        <Link
          href="/forgot-password"
          className="inline-flex min-h-11 items-center font-medium text-brand-700 hover:text-brand-800"
        >
          Forgot password?
        </Link>
      </p>
      <button
        type="submit"
        disabled={submitting}
        className="h-11 w-full rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {submitting ? 'Signing in...' : 'Sign in'}
      </button>
      <p className="text-center text-sm text-slate-600">
        New here?{' '}
        <Link
          href={`/register?next=${encodeURIComponent(next)}`}
          className="font-medium text-brand-600 hover:text-brand-700"
        >
          Create an account
        </Link>
      </p>
    </form>
  );
}
