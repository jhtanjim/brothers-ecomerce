import Link from 'next/link';
import type { CategorySummary } from '@/lib/api/types';
import { SORT_OPTIONS, type ProductQuery } from '@/lib/product-search';

interface ProductFiltersProps {
  query: ProductQuery;
  categories: CategorySummary[];
}

const fieldClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100';
const labelClass = 'mb-1 block text-xs font-medium text-slate-600';

/** A plain GET form: no JavaScript needed. Submitting it resets to page 1. */
export function ProductFilters({ query, categories }: ProductFiltersProps) {
  return (
    <form
      action="/products"
      method="get"
      aria-label="Filter products"
      className="rounded-xl border border-slate-200 bg-slate-50 p-4"
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <div className="lg:col-span-2">
          <label htmlFor="filter-search" className={labelClass}>
            Search
          </label>
          <input
            id="filter-search"
            type="search"
            name="search"
            maxLength={100}
            defaultValue={query.search ?? ''}
            placeholder="Name or SKU"
            className={fieldClass}
          />
        </div>

        <div>
          <label htmlFor="filter-category" className={labelClass}>
            Category
          </label>
          <select
            id="filter-category"
            name="category"
            defaultValue={query.category ?? ''}
            className={fieldClass}
          >
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.slug}>
                {category.name} ({category.productCount})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="filter-sort" className={labelClass}>
            Sort by
          </label>
          <select id="filter-sort" name="sort" defaultValue={query.sort} className={fieldClass}>
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="filter-min" className={labelClass}>
            Min price
          </label>
          <input
            id="filter-min"
            type="number"
            name="minPrice"
            min={0}
            step="any"
            inputMode="decimal"
            defaultValue={query.minPrice ?? ''}
            className={fieldClass}
          />
        </div>

        <div>
          <label htmlFor="filter-max" className={labelClass}>
            Max price
          </label>
          <input
            id="filter-max"
            type="number"
            name="maxPrice"
            min={0}
            step="any"
            inputMode="decimal"
            defaultValue={query.maxPrice ?? ''}
            className={fieldClass}
          />
        </div>
      </div>

      {query.featured && <input type="hidden" name="featured" value="true" />}

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            name="inStock"
            value="true"
            defaultChecked={query.inStock === true}
            className="h-4 w-4 rounded border-slate-300 text-indigo-600"
          />
          In stock only
        </label>
        <div className="ml-auto flex items-center gap-3">
          <Link
            href="/products"
            className="text-sm font-medium text-slate-600 hover:text-indigo-600"
          >
            Clear
          </Link>
          <button
            type="submit"
            className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Apply
          </button>
        </div>
      </div>
    </form>
  );
}
