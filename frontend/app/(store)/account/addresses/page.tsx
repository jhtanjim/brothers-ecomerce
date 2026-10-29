import type { Metadata } from 'next';
import { AccountNav } from '@/components/account/AccountNav';
import { AddressBookContent } from '@/components/account/AddressBookContent';

export const metadata: Metadata = {
  title: 'My addresses',
  robots: { index: false, follow: false },
};

export default function AddressesPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
        My account
      </h1>
      <div className="mt-4">
        <AccountNav />
      </div>
      <div className="mt-6">
        <AddressBookContent />
      </div>
    </main>
  );
}
