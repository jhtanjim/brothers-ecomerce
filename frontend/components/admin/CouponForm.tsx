'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { createAdminCoupon, updateAdminCoupon } from '@/lib/api/admin-coupons';
import { ApiError } from '@/lib/api/client';
import type {
  AdminCoupon,
  CouponStatus,
  CouponType,
  CreateCouponInput,
  UpdateCouponInput,
} from '@/lib/api/types';

const LIST_PATH = '/admin/coupons';
const CODE_PATTERN = /^[A-Z0-9_-]{3,50}$/;
const MONEY_PATTERN = /^\d{1,10}(\.\d{1,2})?$/;
const INPUT_CLASS =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100 disabled:bg-slate-100 disabled:text-slate-500';

interface Values {
  code: string;
  type: CouponType;
  value: string;
  minimumOrderAmount: string;
  maximumDiscount: string;
  usageLimit: string;
  perUserLimit: string;
  startsAt: string;
  expiresAt: string;
  status: CouponStatus;
}

type Errors = Partial<Record<keyof Values, string>>;

/** ISO string -> value for a datetime-local input (the admin's local time). */
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toIso(local: string): string {
  return new Date(local).toISOString();
}

function initialValues(coupon: AdminCoupon | null): Values {
  return {
    code: coupon?.code ?? '',
    type: coupon?.type ?? 'PERCENTAGE',
    value: coupon?.value ?? '',
    minimumOrderAmount: coupon?.minimumOrderAmount ?? '',
    maximumDiscount: coupon?.maximumDiscount ?? '',
    usageLimit: coupon?.usageLimit != null ? String(coupon.usageLimit) : '',
    perUserLimit: coupon?.perUserLimit != null ? String(coupon.perUserLimit) : '',
    startsAt: toLocalInput(coupon?.startsAt ?? null),
    expiresAt: toLocalInput(coupon?.expiresAt ?? null),
    status: coupon?.status ?? 'ACTIVE',
  };
}

function validate(v: Values, locked: boolean): Errors {
  const errors: Errors = {};
  if (!locked && !CODE_PATTERN.test(v.code.trim().toUpperCase())) {
    errors.code = 'Use 3 to 50 characters: letters, numbers, _ or -';
  }
  if (!MONEY_PATTERN.test(v.value) || Number(v.value) <= 0) {
    errors.value = 'Enter an amount above 0 with up to 2 decimals';
  } else if (v.type === 'PERCENTAGE' && Number(v.value) > 100) {
    errors.value = 'A percentage cannot be more than 100';
  }
  if (
    v.minimumOrderAmount !== '' &&
    (!MONEY_PATTERN.test(v.minimumOrderAmount) || Number(v.minimumOrderAmount) <= 0)
  ) {
    errors.minimumOrderAmount = 'Enter an amount above 0 with up to 2 decimals';
  }
  if (
    v.type === 'PERCENTAGE' &&
    v.maximumDiscount !== '' &&
    (!MONEY_PATTERN.test(v.maximumDiscount) || Number(v.maximumDiscount) <= 0)
  ) {
    errors.maximumDiscount = 'Enter an amount above 0 with up to 2 decimals';
  }
  for (const key of ['usageLimit', 'perUserLimit'] as const) {
    const n = Number(v[key]);
    if (v[key] !== '' && (!Number.isInteger(n) || n < 1 || n > 1_000_000)) {
      errors[key] = 'Enter a whole number from 1 to 1,000,000, or leave empty';
    }
  }
  if (
    v.startsAt &&
    v.expiresAt &&
    new Date(v.expiresAt).getTime() <= new Date(v.startsAt).getTime()
  ) {
    errors.expiresAt = 'Expiry must be after the start date';
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

/** Create (coupon = null) or edit. Code and type are read-only once the coupon has been used. */
export function CouponForm({ coupon }: { coupon: AdminCoupon | null }) {
  const router = useRouter();
  const editing = coupon !== null;
  const locked = editing && coupon.usedCount > 0;
  const [values, setValues] = useState<Values>(() => initialValues(coupon));
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
    const found = validate(values, locked);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      setFormError('Please fix the highlighted fields.');
      return;
    }
    setSubmitting(true);
    setFormError(null);
    const percentage = values.type === 'PERCENTAGE';
    try {
      if (!editing) {
        const input: CreateCouponInput = {
          code: values.code.trim().toUpperCase(),
          type: values.type,
          value: values.value,
          status: values.status,
          ...(values.minimumOrderAmount ? { minimumOrderAmount: values.minimumOrderAmount } : {}),
          ...(percentage && values.maximumDiscount
            ? { maximumDiscount: values.maximumDiscount }
            : {}),
          ...(values.usageLimit ? { usageLimit: Number(values.usageLimit) } : {}),
          ...(values.perUserLimit ? { perUserLimit: Number(values.perUserLimit) } : {}),
          ...(values.startsAt ? { startsAt: toIso(values.startsAt) } : {}),
          ...(values.expiresAt ? { expiresAt: toIso(values.expiresAt) } : {}),
        };
        await createAdminCoupon(input);
      } else {
        const input: UpdateCouponInput = {
          value: values.value,
          minimumOrderAmount: values.minimumOrderAmount || null,
          maximumDiscount: percentage ? values.maximumDiscount || null : null,
          usageLimit: values.usageLimit ? Number(values.usageLimit) : null,
          perUserLimit: values.perUserLimit ? Number(values.perUserLimit) : null,
          startsAt: values.startsAt ? toIso(values.startsAt) : null,
          expiresAt: values.expiresAt ? toIso(values.expiresAt) : null,
          ...(locked ? {} : { code: values.code.trim().toUpperCase(), type: values.type }),
        };
        await updateAdminCoupon(coupon.id, input);
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
      {locked ? (
        <p role="status" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          This coupon has been used {coupon.usedCount} {coupon.usedCount === 1 ? 'time' : 'times'},
          so its code and type can no longer be changed.
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Code" htmlFor="code" error={errors.code} hint="Saved in capital letters">
          <input
            id="code"
            value={values.code}
            maxLength={50}
            disabled={locked}
            onChange={(e) => set('code', e.target.value)}
            className={`${INPUT_CLASS} uppercase`}
          />
        </Field>
        <Field label="Type" htmlFor="type">
          <select
            id="type"
            value={values.type}
            disabled={locked}
            onChange={(e) => set('type', e.target.value as CouponType)}
            className={INPUT_CLASS}
          >
            <option value="PERCENTAGE">Percentage (%)</option>
            <option value="FIXED">Fixed amount</option>
          </select>
        </Field>
        <Field
          label={values.type === 'PERCENTAGE' ? 'Percentage' : 'Amount'}
          htmlFor="value"
          error={errors.value}
        >
          <input
            id="value"
            inputMode="decimal"
            value={values.value}
            onChange={(e) => set('value', e.target.value.trim())}
            className={INPUT_CLASS}
          />
        </Field>
        <Field
          label="Minimum order amount"
          htmlFor="minimumOrderAmount"
          error={errors.minimumOrderAmount}
          hint="Checked after product discounts. Leave empty for none"
        >
          <input
            id="minimumOrderAmount"
            inputMode="decimal"
            value={values.minimumOrderAmount}
            onChange={(e) => set('minimumOrderAmount', e.target.value.trim())}
            className={INPUT_CLASS}
          />
        </Field>
        {values.type === 'PERCENTAGE' ? (
          <Field
            label="Maximum discount"
            htmlFor="maximumDiscount"
            error={errors.maximumDiscount}
            hint="Caps the discount. Leave empty for no cap"
          >
            <input
              id="maximumDiscount"
              inputMode="decimal"
              value={values.maximumDiscount}
              onChange={(e) => set('maximumDiscount', e.target.value.trim())}
              className={INPUT_CLASS}
            />
          </Field>
        ) : null}
        <Field
          label="Total usage limit"
          htmlFor="usageLimit"
          error={errors.usageLimit}
          hint="Leave empty for no limit"
        >
          <input
            id="usageLimit"
            inputMode="numeric"
            value={values.usageLimit}
            onChange={(e) => set('usageLimit', e.target.value.trim())}
            className={INPUT_CLASS}
          />
        </Field>
        <Field
          label="Limit per customer"
          htmlFor="perUserLimit"
          error={errors.perUserLimit}
          hint="Counts live orders only. Leave empty for no limit"
        >
          <input
            id="perUserLimit"
            inputMode="numeric"
            value={values.perUserLimit}
            onChange={(e) => set('perUserLimit', e.target.value.trim())}
            className={INPUT_CLASS}
          />
        </Field>
        <Field
          label="Starts"
          htmlFor="startsAt"
          error={errors.startsAt}
          hint="Leave empty to start now"
        >
          <input
            id="startsAt"
            type="datetime-local"
            value={values.startsAt}
            onChange={(e) => set('startsAt', e.target.value)}
            className={INPUT_CLASS}
          />
        </Field>
        <Field
          label="Expires"
          htmlFor="expiresAt"
          error={errors.expiresAt}
          hint="Leave empty for no expiry"
        >
          <input
            id="expiresAt"
            type="datetime-local"
            value={values.expiresAt}
            onChange={(e) => set('expiresAt', e.target.value)}
            className={INPUT_CLASS}
          />
        </Field>
        {!editing ? (
          <Field label="Status" htmlFor="status">
            <select
              id="status"
              value={values.status}
              onChange={(e) => set('status', e.target.value as CouponStatus)}
              className={INPUT_CLASS}
            >
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </Field>
        ) : null}
      </div>

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
          {submitting ? 'Saving...' : editing ? 'Save changes' : 'Create coupon'}
        </button>
        <Link href={LIST_PATH} className="text-sm font-medium text-slate-600 hover:text-slate-800">
          Cancel
        </Link>
      </div>
    </form>
  );
}
