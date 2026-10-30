'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import {
  createAdminCategory,
  getAdminCategories,
  updateAdminCategory,
} from '@/lib/api/admin-categories';
import { ApiError } from '@/lib/api/client';
import type {
  AdminCategory,
  CategoryStatus,
  CreateCategoryInput,
  UpdateCategoryInput,
} from '@/lib/api/types';

const LIST_PATH = '/admin/categories';
const CATEGORY_LIMIT = 100; // API maximum page size
// Same rule as the backend DTO: lowercase letters, numbers and single hyphens.
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const INPUT_CLASS =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100 disabled:bg-slate-100 disabled:text-slate-500';

interface Values {
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
  sortOrder: string;
  status: CategoryStatus;
  parentId: string;
}

type Errors = Partial<Record<keyof Values, string>>;

function initialValues(category: AdminCategory | null): Values {
  return {
    name: category?.name ?? '',
    slug: category?.slug ?? '',
    description: category?.description ?? '',
    imageUrl: category?.imageUrl ?? '',
    sortOrder: String(category?.sortOrder ?? 0),
    status: category?.status ?? 'ACTIVE',
    parentId: category?.parentId ?? '',
  };
}

function isHttpsUrl(text: string): boolean {
  try {
    return new URL(text).protocol === 'https:';
  } catch {
    return false;
  }
}

function validate(v: Values, editing: boolean): Errors {
  const errors: Errors = {};
  const name = v.name.trim();
  if (name.length < 2 || name.length > 100) {
    errors.name = 'Use 2 to 100 characters';
  }
  const slug = v.slug.trim();
  if (editing && slug === '') {
    errors.slug = 'A slug is required';
  } else if (slug !== '' && (!SLUG_PATTERN.test(slug) || slug.length > 120)) {
    errors.slug = 'Use lowercase letters, numbers and single hyphens (max 120)';
  }
  if (v.description.trim().length > 1000) {
    errors.description = 'Use at most 1000 characters';
  }
  const imageUrl = v.imageUrl.trim();
  if (imageUrl !== '' && (!isHttpsUrl(imageUrl) || imageUrl.length > 2048)) {
    errors.imageUrl = 'Enter a full https:// link, or leave empty';
  }
  const sortOrder = Number(v.sortOrder);
  if (v.sortOrder === '' || !Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 100_000) {
    errors.sortOrder = 'Enter a whole number from 0 to 100,000';
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

/** Create (category = null) or edit. Status is changed from the list, like coupons. */
export function CategoryForm({ category }: { category: AdminCategory | null }) {
  const router = useRouter();
  const editing = category !== null;
  const [values, setValues] = useState<Values>(() => initialValues(category));
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [categories, setCategories] = useState<AdminCategory[]>([]);

  useEffect(() => {
    getAdminCategories({ sort: 'sort_order' }, 1, CATEGORY_LIMIT)
      .then(({ items }) => setCategories(items))
      .catch(() => setCategories([]));
  }, []);

  // Only one level of subcategories: a parent must be top-level, and a parent cannot move under one.
  const hasChildren = editing && categories.some((entry) => entry.parentId === category.id);
  const parentOptions = categories.filter(
    (entry) => entry.parentId === null && entry.id !== category?.id,
  );

  const slugChanged = editing && values.slug.trim() !== category.slug;

  function set<K extends keyof Values>(key: K, value: Values[K]) {
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
    const slug = values.slug.trim();
    const description = values.description.trim();
    const imageUrl = values.imageUrl.trim();
    try {
      if (!editing) {
        const input: CreateCategoryInput = {
          name: values.name.trim(),
          sortOrder: Number(values.sortOrder),
          status: values.status,
          ...(slug ? { slug } : {}),
          ...(description ? { description } : {}),
          ...(imageUrl ? { imageUrl } : {}),
          ...(values.parentId ? { parentId: values.parentId } : {}),
        };
        await createAdminCategory(input);
      } else {
        const input: UpdateCategoryInput = {
          name: values.name.trim(),
          description: description || null,
          sortOrder: Number(values.sortOrder),
          parentId: values.parentId || null,
          ...(slugChanged ? { slug } : {}),
          // Sending imageUrl also clears the stored image id on the backend, so only send a change.
          ...(imageUrl !== (category.imageUrl ?? '') ? { imageUrl: imageUrl || null } : {}),
        };
        await updateAdminCategory(category.id, input);
      }
      router.push(LIST_PATH);
      router.refresh();
    } catch (err) {
      setFormError(describeError(err));
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="max-w-2xl space-y-5 rounded-xl border border-slate-200 bg-white p-5"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor="name" error={errors.name}>
          <input
            id="name"
            value={values.name}
            maxLength={100}
            onChange={(e) => set('name', e.target.value)}
            className={INPUT_CLASS}
          />
        </Field>
        <Field
          label="Slug"
          htmlFor="slug"
          error={errors.slug}
          hint={
            editing
              ? 'Used in the category URL. Renaming does not change it'
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
        <Field
          label="Parent category"
          htmlFor="parentId"
          hint={
            hasChildren
              ? 'This category has subcategories, so it stays top-level'
              : 'Leave as none for a main category'
          }
        >
          <select
            id="parentId"
            value={values.parentId}
            disabled={hasChildren}
            onChange={(e) => set('parentId', e.target.value)}
            className={INPUT_CLASS}
          >
            <option value="">None (main category)</option>
            {parentOptions.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name}
                {entry.status === 'INACTIVE' ? ' (inactive)' : ''}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label="Sort order"
          htmlFor="sortOrder"
          error={errors.sortOrder}
          hint="Lower numbers are listed first"
        >
          <input
            id="sortOrder"
            inputMode="numeric"
            value={values.sortOrder}
            onChange={(e) => set('sortOrder', e.target.value.trim())}
            className={INPUT_CLASS}
          />
        </Field>
        {!editing ? (
          <Field label="Status" htmlFor="status">
            <select
              id="status"
              value={values.status}
              onChange={(e) => set('status', e.target.value as CategoryStatus)}
              className={INPUT_CLASS}
            >
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </Field>
        ) : null}
        <div className="sm:col-span-2">
          <Field
            label="Description"
            htmlFor="description"
            error={errors.description}
            hint="Optional"
          >
            <textarea
              id="description"
              rows={3}
              value={values.description}
              maxLength={1000}
              onChange={(e) => set('description', e.target.value)}
              className={INPUT_CLASS}
            />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field
            label="Image URL"
            htmlFor="imageUrl"
            error={errors.imageUrl}
            hint="Optional https:// link. Not shown on the storefront yet"
          >
            <input
              id="imageUrl"
              type="url"
              value={values.imageUrl}
              maxLength={2048}
              onChange={(e) => set('imageUrl', e.target.value)}
              className={INPUT_CLASS}
            />
          </Field>
        </div>
      </div>

      {slugChanged ? (
        <p role="status" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Changing the slug changes this category&apos;s URL. Existing links and search results that
          use the old slug will stop working.
        </p>
      ) : null}

      {formError ? (
        <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {formError}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? 'Saving...' : editing ? 'Save changes' : 'Create category'}
        </button>
        <Link href={LIST_PATH} className="text-sm font-medium text-slate-600 hover:text-slate-800">
          Cancel
        </Link>
      </div>
    </form>
  );
}
