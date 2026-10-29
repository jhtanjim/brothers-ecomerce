import { formatPrice } from '@/lib/format';

interface PriceDisplayProps {
  price: string;
  discountPrice: string | null;
  discountPercent: number;
  size?: 'sm' | 'lg';
  /** Product cards show the percentage on the image instead. */
  showPercent?: boolean;
}

export function PriceDisplay({
  price,
  discountPrice,
  discountPercent,
  size = 'sm',
  showPercent = true,
}: PriceDisplayProps) {
  const hasDiscount = discountPrice !== null && discountPercent > 0;
  const current = hasDiscount ? discountPrice : price;
  const currentClass = size === 'lg' ? 'text-2xl font-bold' : 'text-base font-semibold';
  const oldClass = size === 'lg' ? 'text-base' : 'text-sm';

  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
      <span className={`${currentClass} text-slate-900`}>{formatPrice(current)}</span>
      {hasDiscount && (
        <>
          <span className={`${oldClass} text-slate-500 line-through`}>{formatPrice(price)}</span>
          {showPercent ? (
            <span className="rounded bg-rose-50 px-1.5 py-0.5 text-xs font-semibold text-rose-600">
              -{discountPercent}%
            </span>
          ) : null}
        </>
      )}
    </div>
  );
}
