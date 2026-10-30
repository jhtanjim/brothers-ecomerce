import Link from 'next/link';
import type { CategorySummary, ProductFilterOptions } from '@/lib/api/types';
import { categoriesInTreeOrder, categoryProductCount } from '@/lib/categories';
import { SORT_OPTIONS, type ProductQuery } from '@/lib/product-search';

interface ProductFiltersProps {
  query: ProductQuery;
  categories: CategorySummary[];
  options: ProductFilterOptions;
}

const fieldClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100';
const labelClass = 'mb-1 block text-xs font-medium text-slate-600';

/** Hidden when the catalog has no such values, so a customer never sees an empty filter. */
function OptionSelect({
  name,
  label,
  allLabel,
  values,
  selected,
}: {
  name: string;
  label: string;
  allLabel: string;
  values: string[];
  selected: string | undefined;
}) {
  if (values.length === 0 && !selected) return null;
  // Keep a value from the URL selectable even when it has just sold out.
  const all = selected && !values.includes(selected) ? [selected, ...values] : values;
  return (
    <div>
      <label htmlFor={`filter-${name}`} className={labelClass}>
        {label}
      </label>
      <select
        id={`filter-${name}`}
        name={name}
        defaultValue={selected ?? ''}
        className={fieldClass}
      >
        <option value="">{allLabel}</option>
        {all.map((value) => (
          <option key={value} value={value}>
            {value}
          </option>
        ))}
      </select>
    </div>
  );
}

/** A plain GET form: no JavaScript needed. Submitting it resets to page 1. */
export function ProductFilters({ query, categories, options }: ProductFiltersProps) {
  return (
    <form
      action="/products"
      method="get"
      aria-label="Filter products"
      className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
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
            {categoriesInTreeOrder(categories).map((category) => (
              <option key={category.id} value={category.slug}>
                {category.parentId ? '\u2013 ' : ''}
                {category.name} ({categoryProductCount(categories, category)})
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

        <OptionSelect
          name="size"
          label="Size"
          allLabel="All sizes"
          values={options.sizes}
          selected={query.size}
        />
        <OptionSelect
          name="color"
          label="Colour"
          allLabel="All colours"
          values={options.colors}
          selected={query.color}
        />
        <OptionSelect
          name="material"
          label="Material"
          allLabel="All materials"
          values={options.materials}
          selected={query.material}
        />
      </div>

      {query.featured && <input type="hidden" name="featured" value="true" />}
      {query.newArrival && <input type="hidden" name="newArrival" value="true" />}
      {query.bestSeller && <input type="hidden" name="bestSeller" value="true" />}

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            name="inStock"
            value="true"
            defaultChecked={query.inStock === true}
            className="h-4 w-4 rounded border-slate-300 text-brand-600"
          />
          In stock only
        </label>
        <div className="ml-auto flex items-center gap-3">
          <Link
            href="/products"
            className="text-sm font-medium text-slate-600 hover:text-brand-600"
          >
            Clear
          </Link>
          <button
            type="submit"
            className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Apply
          </button>
        </div>
      </div>
    </form>
  );
}
