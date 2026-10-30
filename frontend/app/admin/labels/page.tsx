import type { Metadata } from 'next';
import { LabelsContent } from '@/components/admin/LabelsContent';

export const metadata: Metadata = { title: 'Barcode labels' };

export default function AdminLabelsPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 print:hidden">
        Barcode labels
      </h1>
      <p className="mt-1 text-sm text-slate-600 print:hidden">
        Print stickers for your items, then scan them in the POS.
      </p>
      <div className="mt-6">
        <LabelsContent />
      </div>
    </div>
  );
}
