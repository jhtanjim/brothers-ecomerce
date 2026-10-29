import type { Metadata } from 'next';
import { Suspense } from 'react';
import { RegisterForm } from '@/components/auth/RegisterForm';

export const metadata: Metadata = {
  title: 'Create account',
  robots: { index: false, follow: false },
};

export default function RegisterPage() {
  return (
    <main className="mx-auto w-full max-w-md px-4 py-12 sm:py-16">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">Create your account</h1>
      <p className="mb-6 mt-1 text-sm text-slate-600">It only takes a minute.</p>
      <Suspense fallback={null}>
        <RegisterForm />
      </Suspense>
    </main>
  );
}