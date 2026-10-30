'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { getAdminProducts } from '@/lib/api/admin-products';
import type { AdminProduct } from '@/lib/api/types';
import { code128Modules, encodeCode128, QUIET_ZONE_MODULES } from '@/lib/code128';
import { formatPrice, optionLabel, SITE_NAME } from '@/lib/format';

const RESULT_LIMIT = 20;
const SEARCH_DELAY_MS = 250;
const MAX_LABELS = 500;
const SIDE_MARGIN_MM = 2;
/** Thinner bars than this are hard for ordinary scanners to read. */
const MIN_BAR_MM = 0.19;
const LABEL_SIZES = [
  { id: '50x30', width: 50, height: 30, label: '50 x 30 mm' },
  { id: '60x40', width: 60, height: 40, label: '60 x 40 mm' },
] as const;

interface LabelItem {
  key: string;
  name: string;
  option: string;
  sku: string;
  price: string;
  stock: number;
}

function itemsOf(product: AdminProduct): LabelItem[] {
  const price = product.discountPrice ?? product.price;
  if (product.variants.length === 0) {
    return [
      {
        key: product.id,
        name: product.name,
        option: '',
        sku: product.sku,
        price,
        stock: product.stockQuantity,
      },
    ];
  }
  return product.variants.map((variant) => ({
    key: `${product.id}:${variant.id}`,
    name: product.name,
    option: optionLabel(variant.size, variant.color),
    sku: variant.sku,
    price,
    stock: variant.stockQuantity,
  }));
}

function Barcode({ text }: { text: string }) {
  const bars = encodeCode128(text);
  const width = bars.length + QUIET_ZONE_MODULES * 2;
  return (
    <svg
      viewBox={`0 0 ${width} 10`}
      preserveAspectRatio="none"
      shapeRendering="crispEdges"
      role="img"
      aria-label={`Barcode ${text}`}
      className="block h-full w-full"
    >
      {[...bars].map((bar, index) =>
        bar === '1' ? (
          <rect
            key={index}
            x={index + QUIET_ZONE_MODULES}
            y={0}
            width={1}
            height={10}
            fill="#000"
          />
        ) : null,
      )}
    </svg>
  );
}

function Label({
  item,
  size,
  showPrice,
}: {
  item: LabelItem;
  size: (typeof LABEL_SIZES)[number];
  showPrice: boolean;
}) {
  return (
    <div
      className="label flex flex-col overflow-hidden bg-white text-black"
      style={{
        width: `${size.width}mm`,
        height: `${size.height}mm`,
        padding: `1mm ${SIDE_MARGIN_MM}mm`,
        fontSize: '2.6mm',
        lineHeight: 1.15,
      }}
    >
      <div className="flex justify-between gap-1 font-semibold">
        <span className="truncate">{SITE_NAME}</span>
        {showPrice ? <span className="shrink-0">{formatPrice(item.price)}</span> : null}
      </div>
      <p className="truncate">{item.name}</p>
      {item.option ? <p className="truncate">{item.option}</p> : null}
      <div className="min-h-0 flex-1 py-[0.5mm]">
        <Barcode text={item.sku} />
      </div>
      <p className="text-center font-mono">{item.sku}</p>
    </div>
  );
}

/** Pick items and how many stickers of each, then print on a label roll. */
export function LabelsContent() {
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<LabelItem[]>([]);
  const [failed, setFailed] = useState(false);
  const [chosen, setChosen] = useState<Record<string, { item: LabelItem; count: number }>>({});
  const [sizeId, setSizeId] = useState<(typeof LABEL_SIZES)[number]['id']>('50x30');
  const [showPrice, setShowPrice] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      getAdminProducts({ status: 'ACTIVE', search: search.trim() || undefined }, 1, RESULT_LIMIT)
        .then(({ items: products }) => {
          if (cancelled) return;
          setItems(products.flatMap(itemsOf));
          setFailed(false);
        })
        .catch(() => {
          if (!cancelled) setFailed(true);
        });
    }, SEARCH_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [search]);

  const size = LABEL_SIZES.find((entry) => entry.id === sizeId) ?? LABEL_SIZES[0];
  const lines = Object.values(chosen).filter((line) => line.count > 0);
  const total = lines.reduce((sum, line) => sum + line.count, 0);
  const printableMm = size.width - SIDE_MARGIN_MM * 2;
  const tooLong = lines
    .map((line) => line.item.sku)
    .filter((sku) => printableMm / code128Modules(sku) < MIN_BAR_MM);

  function setCount(item: LabelItem, count: number) {
    const clean = Number.isFinite(count) ? Math.max(0, Math.min(Math.floor(count), MAX_LABELS)) : 0;
    setChosen((current) => ({ ...current, [item.key]: { item, count: clean } }));
  }

  const sheet = lines.flatMap((line) =>
    Array.from({ length: line.count }, (_, index) => ({ key: `${line.item.key}-${index}`, line })),
  );

  return (
    <div className="grid gap-6 lg:grid-cols-5 lg:items-start print:hidden">
      <style>{`
        @media print {
          @page { size: ${size.width}mm ${size.height}mm; margin: 0; }
          body > *:not(#label-sheet) { display: none !important; }
          #label-sheet { display: block !important; }
          #label-sheet .label { break-after: page; }
          #label-sheet .label:last-child { break-after: auto; }
        }
      `}</style>

      <section className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-3">
        <h2 className="text-lg font-semibold text-slate-900">Choose items</h2>
        <label htmlFor="labelSearch" className="sr-only">
          Search by name or SKU
        </label>
        <input
          id="labelSearch"
          type="search"
          value={search}
          maxLength={100}
          placeholder="Search by name or SKU"
          onChange={(e) => setSearch(e.target.value)}
          className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        {failed ? (
          <p role="alert" className="mt-3 text-sm text-rose-700">
            Could not load products. Check your connection.
          </p>
        ) : null}
        <ul className="mt-2 divide-y divide-slate-100">
          {items.map((item) => (
            <li key={item.key} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0 text-sm">
                <p className="font-medium text-slate-900">{item.name}</p>
                <p className="text-slate-600">
                  {item.option ? `${item.option}, ` : ''}
                  {item.stock} in stock
                </p>
                <p className="font-mono text-xs text-slate-500">{item.sku}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={item.stock < 1}
                  onClick={() => setCount(item, item.stock)}
                  className="min-h-11 border border-slate-300 px-3 text-sm font-medium text-slate-800 hover:border-brand-950 disabled:opacity-40"
                >
                  One for each
                </button>
                <label htmlFor={`count-${item.key}`} className="sr-only">
                  Number of labels for {item.sku}
                </label>
                <input
                  id={`count-${item.key}`}
                  type="number"
                  min={0}
                  max={MAX_LABELS}
                  value={chosen[item.key]?.count ?? 0}
                  onChange={(e) => setCount(item, Number(e.target.value))}
                  className="h-11 w-20 rounded-lg border border-slate-300 px-2 text-sm"
                />
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 lg:col-span-2">
        <h2 className="text-lg font-semibold text-slate-900">Print</h2>
        <div>
          <label htmlFor="labelSize" className="mb-1 block text-sm font-medium text-slate-700">
            Label size
          </label>
          <select
            id="labelSize"
            value={sizeId}
            onChange={(e) => setSizeId(e.target.value as typeof sizeId)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            {LABEL_SIZES.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.label}
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={showPrice}
            onChange={(e) => setShowPrice(e.target.checked)}
            className="h-4 w-4"
          />
          Show the price
        </label>

        {tooLong.length > 0 ? (
          <p role="alert" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            These SKUs are long for this label, so scanners may struggle: {tooLong.join(', ')}. Use
            a bigger label or a shorter SKU.
          </p>
        ) : null}

        {lines[0] ? (
          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">Preview</p>
            <div className="inline-block border border-slate-300">
              <Label item={lines[0].item} size={size} showPrice={showPrice} />
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-500">Set a number next to an item to see a label.</p>
        )}

        {total > MAX_LABELS ? (
          <p role="alert" className="text-sm text-rose-700">
            Print at most {MAX_LABELS} labels at a time.
          </p>
        ) : null}

        <button
          type="button"
          disabled={total < 1 || total > MAX_LABELS}
          onClick={() => window.print()}
          className="min-h-12 w-full bg-brand-950 px-5 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Print {total} {total === 1 ? 'label' : 'labels'}
        </button>
      </section>

      {/* Directly under body, so printing can leave out the whole admin page. */}
      {mounted && total <= MAX_LABELS
        ? createPortal(
            <div id="label-sheet" className="hidden">
              {sheet.map(({ key, line }) => (
                <Label key={key} item={line.item} size={size} showPrice={showPrice} />
              ))}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
