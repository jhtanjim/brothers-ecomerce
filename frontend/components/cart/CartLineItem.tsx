import Image from 'next/image';
import Link from 'next/link';
import type { CartLine } from '@/lib/api/types';
import { formatPrice } from '@/lib/format';

/** Keep in sync with MAX_QUANTITY_PER_LINE in the backend (the backend enforces it anyway). */
const MAX_QUANTITY = 20;

interface CartLineItemProps {
  line: CartLine;
  busy: boolean;
  onChangeQuantity: (line: CartLine, quantity: number) => void;
  onRemove: (line: CartLine) => void;
}

function issueMessage(line: CartLine): string | null {
  switch (line.issue) {
    case 'PRODUCT_UNAVAILABLE':
      return 'This product is no longer available. Remove it to continue.';
    case 'OUT_OF_STOCK':
      return 'This product is out of stock. Remove it to continue.';
    case 'INSUFFICIENT_STOCK':
      return `Only ${line.availableStock} left in stock. Reduce the quantity to continue.`;
    default:
      return null;
  }
}

export function CartLineItem({ line, busy, onChangeQuantity, onRemove }: CartLineItemProps) {
  const message = issueMessage(line);
  const hasDiscount = Number(line.regularPrice) > Number(line.unitPrice);
  // The backend rejects updates for unavailable and out-of-stock products.
  const stepperLocked = line.issue === 'PRODUCT_UNAVAILABLE' || line.issue === 'OUT_OF_STOCK';
  const max = Math.max(1, Math.min(line.availableStock, MAX_QUANTITY));
  const canDecrease = !stepperLocked && !busy && line.quantity > 1;
  const canIncrease = !stepperLocked && !busy && line.quantity < max;
  const linkable = line.issue !== 'PRODUCT_UNAVAILABLE';

  const nameNode = linkable ? (
    <Link href={`/products/${line.slug}`} className="hover:text-indigo-600">
      {line.name}
    </Link>
  ) : (
    <span>{line.name}</span>
  );

  return (
    <li
      className={`rounded-xl border bg-white p-4 ${line.issue ? 'border-amber-300' : 'border-slate-200'}`}
    >
      <div className="flex gap-4">
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-slate-100 sm:h-24 sm:w-24">
          {line.imageUrl ? (
            <Image src={line.imageUrl} alt={line.name} fill sizes="96px" className="object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-slate-400">No image</div>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex items-start justify-between gap-3">
            <h2 className="line-clamp-2 text-sm font-medium text-slate-900 sm:text-base">{nameNode}</h2>
            <p className="shrink-0 text-sm font-semibold text-slate-900 sm:text-base">
              {formatPrice(line.lineTotal)}
            </p>
          </div>

          <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
            <span className="text-slate-700">{formatPrice(line.unitPrice)}</span>
            {hasDiscount ? (
              <span className="text-slate-400 line-through">{formatPrice(line.regularPrice)}</span>
            ) : null}
            <span className="text-slate-500">each</span>
          </div>

          <div className="mt-auto flex flex-wrap items-center gap-3">
            <div className="flex items-center rounded-lg border border-slate-300">
              <button
                type="button"
                aria-label={`Decrease quantity of ${line.name}`}
                onClick={() => onChangeQuantity(line, Math.min(line.quantity - 1, max))}
                disabled={!canDecrease}
                className="px-3 py-1.5 text-lg text-slate-700 hover:text-indigo-600 disabled:opacity-40"
              >
                -
              </button>
              <span aria-live="polite" className="w-10 text-center text-sm font-medium text-slate-900">
                {line.quantity}
              </span>
              <button
                type="button"
                aria-label={`Increase quantity of ${line.name}`}
                onClick={() => onChangeQuantity(line, line.quantity + 1)}
                disabled={!canIncrease}
                className="px-3 py-1.5 text-lg text-slate-700 hover:text-indigo-600 disabled:opacity-40"
              >
                +
              </button>
            </div>

            <button
              type="button"
              onClick={() => onRemove(line)}
              disabled={busy}
              className="text-sm font-medium text-rose-600 hover:text-rose-700 disabled:opacity-40"
            >
              Remove
            </button>
          </div>
        </div>
      </div>

      {message ? (
        <p role="alert" className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {message}
        </p>
      ) : null}
    </li>
  );
}