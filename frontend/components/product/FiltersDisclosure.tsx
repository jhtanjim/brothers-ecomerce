'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';

const PANEL_ID = 'product-filters';

/**
 * Phones: the filter form is folded behind a "Filters" button so results come first.
 * From lg up the form is always visible and the button is hidden.
 */
export function FiltersDisclosure({
  activeCount,
  children,
}: {
  activeCount: number;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={PANEL_ID}
        onClick={() => setOpen((value) => !value)}
        className="flex h-11 items-center gap-2 rounded-full border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 hover:border-slate-400 lg:hidden"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          className="h-5 w-5"
          aria-hidden="true"
        >
          <path d="M4 6h16M7 12h10M10 18h4" />
        </svg>
        {open ? 'Hide filters' : 'Filters & sort'}
        {activeCount > 0 ? (
          <span className="rounded-full bg-brand-600 px-2 text-xs font-bold leading-5 text-white">
            {activeCount}
          </span>
        ) : null}
      </button>
      <div id={PANEL_ID} className={`${open ? 'mt-3 block' : 'hidden'} lg:mt-0 lg:block`}>
        {children}
      </div>
    </div>
  );
}
