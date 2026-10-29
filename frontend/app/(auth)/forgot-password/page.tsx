import type { Metadata } from 'next';
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm';

export const metadata: Metadata = {
  title: 'Forgot password',
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return (
    <main className="mx-auto w-full max-w-md px-4 py-12 sm:py-16">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">Forgot your password?</h1>
      <p className="mb-6 mt-1 text-sm text-slate-600">
        Enter the email you signed up with and we will send you a link to choose a new password.
      </p>
      <ForgotPasswordForm />
    </main>
  );
}
