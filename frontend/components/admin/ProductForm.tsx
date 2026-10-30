'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { getAdminCategories } from '@/lib/api/admin-categories';
import { createAdminProduct, updateAdminProduct } from '@/lib/api/admin-products';
import { ApiError } from '@/lib/api/client';
import { categoriesInTreeOrder } from '@/lib/categories';
import type {
  AdminCategory,
  AdminProduct,
  CreateProductInput,
  UpdateProductInput,
} from '@/lib/api/types';

const LIST_PATH = '/admin/products';
const CATEGORY_LIMIT = 100; // API maximum page size
// Same rules as the backend DTOs.
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SKU_PATTERN = /^[A-Z0-9][A-Z0-9._-]*$/;
const MONEY_PATTERN = /^\d{1,10}(\.\d{1,2})?$/;
const MAX_STOCK = 1_000_000;
const INPUT_CLASS =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100 disabled:bg-slate-100 disabled:text-slate-500';

interface Values {
  categoryId: string;
  name: string;
  slug: string;
  sku: string;
  shortDescription: string;
  description: string;
  price: string;
  discountPrice: string;
  stockQuantity: string;
  lowStockThreshold: string;
  featured: boolean;
  newArrival: boolean;
  bestSeller: boolean;
  material: string;
  status: 'ACTIVE' | 'INACTIVE';
}

type Errors = Partial<Record<keyof Values, string>>;

/** "1200" / "1200.5" from the API -> the same text for the input. */
function moneyText(value: string | null | undefined): string {
  if (!value) return '';
  const amount = Number(value);
  return Number.isFinite(amount) ? String(amount) : '';
}

function initialValues(product: AdminProduct | null): Values {
  return {
    categoryId: product?.categoryId ?? '',
    name: product?.name ?? '',
    slug: product?.slug ?? '',
    sku: product?.sku ?? '',
    shortDescription: product?.shortDescription ?? '',
    description: product?.description ?? '',
    price: moneyText(product?.price),
    discountPrice: moneyText(product?.discountPrice),
    stockQuantity: String(product?.stockQuantity ?? 0),
    lowStockThreshold: String(product?.lowStockThreshold ?? 5),
    featured: product?.featured ?? false,
    newArrival: product?.newArrival ?? false,
    bestSeller: product?.bestSeller ?? false,
    material: product?.material ?? '',
    status: 'ACTIVE',
  };
}

function isWholeNumber(text: string, max: number): boolean {
  const n = Number(text);
  return text !== '' && Number.isInteger(n) && n >= 0 && n <= max;
}

function validate(v: Values, editing: boolean): Errors {
  const errors: Errors = {};
  if (!v.categoryId) errors.categoryId = 'Choose a category';
  const name = v.name.trim();
  if (name.length < 2 || name.length > 200) errors.name = 'Use 2 to 200 characters';
  const slug = v.slug.trim();
  if (editing && slug === '') {
    errors.slug = 'A slug is required';
  } else if (slug !== '' && (!SLUG_PATTERN.test(slug) || slug.length > 120)) {
    errors.slug = 'Use lowercase letters, numbers and single hyphens (max 120)';
  }
  const sku = v.sku.trim().toUpperCase();
  if (sku.length < 2 || sku.length > 64 || !SKU_PATTERN.test(sku)) {
    errors.sku = 'Use 2 to 64 letters, numbers, dots, underscores or hyphens';
  }
  if (v.shortDescription.trim().length > 500)
    errors.shortDescription = 'Use at most 500 characters';
  if (v.description.trim().length > 10_000) errors.description = 'Use at most 10,000 characters';
  if (v.material.trim().length > 120) errors.material = 'Use at most 120 characters';
  if (!MONEY_PATTERN.test(v.price) || Number(v.price) <= 0) {
    errors.price = 'Enter an amount above 0 with up to 2 decimals';
  }
  if (v.discountPrice !== '') {
    if (!MONEY_PATTERN.test(v.discountPrice) || Number(v.discountPrice) <= 0) {
      errors.discountPrice = 'Enter an amount above 0 with up to 2 decimals, or leave empty';
    } else if (!errors.price && Number(v.discountPrice) >= Number(v.price)) {
      errors.discountPrice = 'The sale price must be lower than the regular price';
    }
  }
  if (!isWholeNumber(v.stockQuantity, MAX_STOCK)) {
    errors.stockQuantity = 'Enter a whole number from 0 to 1,000,000';
  }
  if (!isWholeNumber(v.lowStockThreshold, MAX_STOCK)) {
    errors.lowStockThreshold = 'Enter a whole number from 0 to 1,000,000';
  }
  return errors;
}

function describeError(err: unknown): string {
  if (!(err instanceof ApiError)) return 'Something went wrong. Please try again.';
  if (err.status === 0) return 'Unable to reach the server. Please try again.';
  if (err.status === 429) return 'Too many attempts. Please wait a minute and try again.';
  return err.message;
}

function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1 block text-sm font-medium text-slate-700">
        {label}
      </label>
      {children}
      {hint && !error ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
      {error ? (
        <p role="alert" className="mt-1 text-xs text-rose-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Create (product = null) or edit. Status is changed from the list. After creating, the admin
 * lands on the edit page, where images can be uploaded.
 */
export function ProductForm({
  product,
  onSaved,
}: {
  product: AdminProduct | null;
  /** Edit mode: called with the saved product instead of navigating away. */
  onSaved?: (product: AdminProduct) => void;
}) {
  const router = useRouter();
  const editing = product !== null;
  const [values, setValues] = useState<Values>(() => initialValues(product));
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [categories, setCategories] = useState<AdminCategory[] | null>(null);

  useEffect(() => {
    getAdminCategories({ sort: 'sort_order' }, 1, CATEGORY_LIMIT)
      .then(({ items }) => setCategories(items))
      .catch(() => setCategories([]));
  }, []);

  const slugChanged = editing && values.slug.trim() !== product.slug;
  // With options, the total is the sum of their stock and is not edited here.
  const hasVariants = (product?.variants.length ?? 0) > 0;

  function set<K extends keyof Values>(key: K, value: Values[K]) {
    setSavedNotice(false);
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const found = validate(values, editing);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      setFormError('Please fix the highlighted fields.');
      return;
    }
    setSubmitting(true);
    setFormError(null);
    setSavedNotice(false);
    const slug = values.slug.trim();
    const shortDescription = values.shortDescription.trim();
    const description = values.description.trim();
    const material = values.material.trim();
    const common = {
      categoryId: values.categoryId,
      name: values.name.trim(),
      sku: values.sku.trim().toUpperCase(),
      price: Number(values.price),
      ...(hasVariants ? {} : { stockQuantity: Number(values.stockQuantity) }),
      lowStockThreshold: Number(values.lowStockThreshold),
      featured: values.featured,
      newArrival: values.newArrival,
      bestSeller: values.bestSeller,
    };
    try {
      if (!editing) {
        const input: CreateProductInput = {
          ...common,
          status: values.status,
          ...(slug ? { slug } : {}),
          ...(shortDescription ? { shortDescription } : {}),
          ...(description ? { description } : {}),
          ...(material ? { material } : {}),
          ...(values.discountPrice ? { discountPrice: Number(values.discountPrice) } : {}),
        };
        const created = await createAdminProduct(input);
        router.push(`${LIST_PATH}/${encodeURIComponent(created.id)}/edit?created=1`);
        return;
      }
      const input: UpdateProductInput = {
        ...common,
        shortDescription: shortDescription || null,
        description: description || null,
        material: material || null,
        discountPrice: values.discountPrice ? Number(values.discountPrice) : null,
        ...(slugChanged ? { slug } : {}),
      };
      const saved = await updateAdminProduct(product.id, input);
      setValues(initialValues(saved));
      setSavedNotice(true);
      setSubmitting(false);
      onSaved?.(saved);
    } catch (err) {
      setFormError(describeError(err));
      setSubmitting(false);
    }
  }

  const categoryMissing =
    categories !== null &&
    values.categoryId !== '' &&
    !categories.some((category) => category.id === values.categoryId);

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="max-w-3xl space-y-5 rounded-xl border border-slate-200 bg-white p-5"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="Name" htmlFor="name" error={errors.name}>
            <input
              id="name"
              value={values.name}
              maxLength={200}
              onChange={(e) => set('name', e.target.value)}
              className={INPUT_CLASS}
            />
          </Field>
        </div>
        <Field label="Category" htmlFor="categoryId" error={errors.categoryId}>
          <select
            id="categoryId"
            value={values.categoryId}
            disabled={categories === null}
            onChange={(e) => set('categoryId', e.target.value)}
            className={INPUT_CLASS}
          >
            <option value="">{categories === null ? 'Loading...' : 'Choose a category'}</option>
            {categoryMissing && product ? (
              <option value={product.categoryId}>{product.category.name}</option>
            ) : null}
            {categoriesInTreeOrder(categories ?? []).map((category) => (
              <option key={category.id} value={category.id}>
                {category.parentId ? '\u2013 ' : ''}
                {category.name}
                {category.status === 'INACTIVE' ? ' (inactive)' : ''}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label="SKU"
          htmlFor="sku"
          error={errors.sku}
          hint="Your stock code. Saved in capital letters"
        >
          <input
            id="sku"
            value={values.sku}
            maxLength={64}
            onChange={(e) => set('sku', e.target.value)}
            className={`${INPUT_CLASS} uppercase`}
          />
        </Field>
        <Field label="Regular price (BDT)" htmlFor="price" error={errors.price}>
          <input
            id="price"
            inputMode="decimal"
            value={values.price}
            onChange={(e) => set('price', e.target.value.trim())}
            className={INPUT_CLASS}
          />
        </Field>
        <Field
          label="Sale price (BDT)"
          htmlFor="discountPrice"
          error={errors.discountPrice}
          hint="Optional. Must be lower than the regular price"
        >
          <input
            id="discountPrice"
            inputMode="decimal"
            value={values.discountPrice}
            onChange={(e) => set('discountPrice', e.target.value.trim())}
            className={INPUT_CLASS}
          />
        </Field>
        <Field
          label="Stock quantity"
          htmlFor="stockQuantity"
          error={errors.stockQuantity}
          hint={
            hasVariants
              ? 'Sum of the sizes and colours above. Change it there'
              : editing
                ? 'Units on hand now. Unpaid orders already hold their units'
                : 'Sizes and colours can be added after creating the product'
          }
        >
          <input
            id="stockQuantity"
            inputMode="numeric"
            disabled={hasVariants}
            value={hasVariants ? String(product?.stockQuantity ?? 0) : values.stockQuantity}
            onChange={(e) => set('stockQuantity', e.target.value.trim())}
            className={INPUT_CLASS}
          />
        </Field>
        <Field
          label="Low-stock alert at"
          htmlFor="lowStockThreshold"
          error={errors.lowStockThreshold}
          hint="Shown as low stock at or below this number"
        >
          <input
            id="lowStockThreshold"
            inputMode="numeric"
            value={values.lowStockThreshold}
            onChange={(e) => set('lowStockThreshold', e.target.value.trim())}
            className={INPUT_CLASS}
          />
        </Field>
        <Field
          label="Slug"
          htmlFor="slug"
          error={errors.slug}
          hint={
            editing
              ? 'Used in the product URL. Renaming does not change it'
              : 'Leave empty to generate it from the name'
          }
        >
          <input
            id="slug"
            value={values.slug}
            maxLength={120}
            onChange={(e) => set('slug', e.target.value.trim().toLowerCase())}
            className={INPUT_CLASS}
          />
        </Field>
        {!editing ? (
          <Field label="Status" htmlFor="status" hint="Inactive products are hidden from the store">
            <select
              id="status"
              value={values.status}
              onChange={(e) => set('status', e.target.value as Values['status'])}
              className={INPUT_CLASS}
            >
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </Field>
        ) : null}
        <Field
          label="Material"
          htmlFor="material"
          error={errors.material}
          hint="Optional. For example 100% cotton. Also used as a store filter"
        >
          <input
            id="material"
            value={values.material}
            maxLength={120}
            onChange={(e) => set('material', e.target.value)}
            className={INPUT_CLASS}
          />
        </Field>
        <div className="flex items-center gap-2 sm:col-span-2">
          <input
            id="newArrival"
            type="checkbox"
            checked={values.newArrival}
            onChange={(e) => set('newArrival', e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
          />
          <label htmlFor="newArrival" className="text-sm font-medium text-slate-700">
            Show in New arrivals
          </label>
        </div>
        <div className="flex items-center gap-2 sm:col-span-2">
          <input
            id="bestSeller"
            type="checkbox"
            checked={values.bestSeller}
            onChange={(e) => set('bestSeller', e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
          />
          <label htmlFor="bestSeller" className="text-sm font-medium text-slate-700">
            Show in Best sellers
          </label>
        </div>
        <div className="flex items-center gap-2 sm:col-span-2">
          <input
            id="featured"
            type="checkbox"
            checked={values.featured}
            onChange={(e) => set('featured', e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
          />
          <label htmlFor="featured" className="text-sm font-medium text-slate-700">
            Featured on the home page
          </label>
        </div>
        <div className="sm:col-span-2">
          <Field
            label="Short description"
            htmlFor="shortDescription"
            error={errors.shortDescription}
            hint="Optional. One or two sentences shown near the price"
          >
            <textarea
              id="shortDescription"
              rows={2}
              value={values.shortDescription}
              maxLength={500}
              onChange={(e) => set('shortDescription', e.target.value)}
              className={INPUT_CLASS}
            />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field
            label="Full description"
            htmlFor="description"
            error={errors.description}
            hint="Optional"
          >
            <textarea
              id="description"
              rows={6}
              value={values.description}
              maxLength={10_000}
              onChange={(e) => set('description', e.target.value)}
              className={INPUT_CLASS}
            />
          </Field>
        </div>
      </div>

      {slugChanged ? (
        <p role="status" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Changing the slug changes this product&apos;s URL. Existing links and search results that
          use the old slug will stop working.
        </p>
      ) : null}

      {formError ? (
        <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {formError}
        </p>
      ) : null}
      {savedNotice ? (
        <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Changes saved.
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? 'Saving...' : editing ? 'Save changes' : 'Create and add images'}
        </button>
        <Link href={LIST_PATH} className="text-sm font-medium text-slate-600 hover:text-slate-800">
          {editing ? 'Back to products' : 'Cancel'}
        </Link>
      </div>
    </form>
  );
}
