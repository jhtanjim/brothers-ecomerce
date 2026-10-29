'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { AuthFormField } from '@/components/auth/AuthFormField';
import { resetPassword } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/client';

// Same limits as the backend ResetPasswordDto.
const MIN_LENGTH = 8;
const MAX_LENGTH = 72;

export function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const { status, logout } = useAuth();
  // Read once, then kept only in memory: the token is a credential.
  const [token] = useState(() => searchParams.get('token')?.trim() ?? '');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Remove the token from the address bar so it does not stay in history or get copied with the URL.
  useEffect(() => {
    if (searchParams.has('token')) {
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, [searchParams]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get('newPassword') ?? '');
    const confirm = String(form.get('confirmPassword') ?? '');
    if (password.length < MIN_LENGTH || password.length > MAX_LENGTH) {
      setError(`Use ${MIN_LENGTH} to ${MAX_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      setError('The two passwords do not match.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await resetPassword(token, password);
      // Every session of the account was ended on the server; clear this browser's too.
      if (status === 'authenticated') await logout();
      setDone(true);
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 429
          ? 'Too many attempts. Please wait a minute and try again.'
          : err instanceof ApiError && err.status === 400
            ? 'This reset link is invalid or has expired. Please request a new one.'
            : 'Unable to reset the password right now. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (!token) {
    return (
      <div className="space-y-4">
        <p role="alert" className="rounded-lg bg-amber-50 px-3 py-3 text-sm text-amber-800">
          This page needs the link from your password reset email.
        </p>
        <Link
          href="/forgot-password"
          className="block w-full rounded-lg bg-brand-600 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-brand-700"
        >
          Request a reset link
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="space-y-4">
        <p role="status" className="rounded-lg bg-emerald-50 px-3 py-3 text-sm text-emerald-800">
          Your password has been changed. For your security you have been signed out everywhere.
        </p>
        <Link
          href="/login"
          className="block w-full rounded-lg bg-brand-600 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-brand-700"
        >
          Sign in with your new password
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}{' '}
          {error.startsWith('This reset link') ? (
            <Link href="/forgot-password" className="font-medium underline">
              Request a new link
            </Link>
          ) : null}
        </p>
      ) : null}
      <AuthFormField
        label="New password"
        name="newPassword"
        type="password"
        autoComplete="new-password"
        minLength={MIN_LENGTH}
        maxLength={MAX_LENGTH}
        hint={`At least ${MIN_LENGTH} characters.`}
        required
      />
      <AuthFormField
        label="Confirm new password"
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        maxLength={MAX_LENGTH}
        required
      />
      <button
        type="submit"
        disabled={submitting}
        className="h-11 w-full rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {submitting ? 'Saving...' : 'Set new password'}
      </button>
    </form>
  );
}
