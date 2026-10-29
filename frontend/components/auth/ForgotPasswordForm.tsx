'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { AuthFormField } from '@/components/auth/AuthFormField';
import { forgotPassword } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/client';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function describeError(err: unknown): string {
  if (err instanceof ApiError && err.status === 429) {
    return 'Too many requests. Please wait a minute and try again.';
  }
  if (err instanceof ApiError && err.status === 400) return 'Enter a valid email address.';
  return 'Unable to send the reset link right now. Please try again.';
}

export function ForgotPasswordForm() {
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get('email') ?? '').trim();
    if (!EMAIL_PATTERN.test(email)) {
      setError('Enter a valid email address.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await forgotPassword(email);
      setSentTo(email);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (sentTo) {
    return (
      <div className="space-y-4">
        <p role="status" className="rounded-lg bg-emerald-50 px-3 py-3 text-sm text-emerald-800">
          If an account exists for <span className="font-semibold">{sentTo}</span>, we have sent a
          link to reset the password. The link works once and expires in 30 minutes.
        </p>
        <p className="text-sm text-slate-600">
          Did not get it? Check your spam folder, or{' '}
          <button
            type="button"
            onClick={() => setSentTo(null)}
            className="font-medium text-brand-700 underline hover:text-brand-800"
          >
            try again
          </button>
          .
        </p>
        <Link
          href="/login"
          className="block text-center text-sm font-medium text-brand-700 hover:text-brand-800"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      <AuthFormField label="Email" name="email" type="email" autoComplete="email" required />
      <button
        type="submit"
        disabled={submitting}
        className="h-11 w-full rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {submitting ? 'Sending...' : 'Send reset link'}
      </button>
      <p className="text-center text-sm text-slate-600">
        Remembered it?{' '}
        <Link href="/login" className="font-medium text-brand-700 hover:text-brand-800">
          Sign in
        </Link>
      </p>
    </form>
  );
}
