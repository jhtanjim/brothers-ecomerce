import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm';

export const metadata: Metadata = {
  title: 'Choose a new password',
  robots: { index: false, follow: false },
  // The URL carries a reset token: never send it to other sites in the Referer header.
  referrer: 'no-referrer',
};

export default function ResetPasswordPage() {
  return (
    <main className="mx-auto w-full max-w-md px-4 py-12 sm:py-16">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">Choose a new password</h1>
      <p className="mb-6 mt-1 text-sm text-slate-600">
        After saving, you will be signed out on all devices and can sign in with the new password.
      </p>
      {/* useSearchParams (the token) requires a Suspense boundary. */}
      <Suspense fallback={null}>
        <ResetPasswordForm />
      </Suspense>
    </main>
  );
}
