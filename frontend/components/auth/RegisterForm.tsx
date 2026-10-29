'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { AuthFormField } from '@/components/auth/AuthFormField';
import { ApiError } from '@/lib/api/client';
import { safeNextPath } from '@/lib/safe-redirect';

const PHONE_PATTERN = /^\+?[0-9]{7,15}$/;

export function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNextPath(searchParams.get('next'));
  const { status, register } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (status === 'authenticated') router.replace(next);
  }, [status, next, router]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get('name') ?? '').trim();
    const email = String(form.get('email') ?? '').trim();
    const phone = String(form.get('phone') ?? '').trim();
    const password = String(form.get('password') ?? '');

    // Quick client checks only; the backend DTO remains the source of truth.
    if (name.length < 2) return setError('Please enter your full name.');
    if (phone && !PHONE_PATTERN.test(phone)) return setError('Enter a valid phone number, e.g. 01712345678.');
    if (password.length < 8) return setError('Password must be at least 8 characters.');

    setError(null);
    setSubmitting(true);
    try {
      await register({ name, email, password, ...(phone ? { phone } : {}) });
      router.replace(next);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiError && err.status !== 0
          ? err.message
          : 'Unable to create your account right now. Please try again.',
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
      <AuthFormField label="Full name" name="name" autoComplete="name" required maxLength={100} />
      <AuthFormField label="Email" name="email" type="email" autoComplete="email" required />
      <AuthFormField
        label="Phone (optional)"
        name="phone"
        type="tel"
        autoComplete="tel"
        hint="Digits only, optional + prefix."
      />
      <AuthFormField
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        maxLength={72}
        hint="At least 8 characters."
      />
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
      >
        {submitting ? 'Creating account...' : 'Create account'}
      </button>
      <p className="text-center text-sm text-slate-600">
        Already have an account?{' '}
        <Link
          href={`/login?next=${encodeURIComponent(next)}`}
          className="font-medium text-indigo-600 hover:text-indigo-700"
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}