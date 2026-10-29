'use client';

import { useEffect, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { ErrorState } from '@/components/ui/ErrorState';
import { getAdminSettings, updateAdminSettings } from '@/lib/api/admin-settings';
import { ApiError } from '@/lib/api/client';
import type { AdminSettings, UpdateSettingsInput } from '@/lib/api/types';
import { formatPrice } from '@/lib/format';

const MONEY_PATTERN = /^\d{1,10}(\.\d{1,2})?$/;
const PHONE_PATTERN = /^\+?[0-9]{7,15}$/;
const INPUT_CLASS =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100';

interface Values {
  deliveryHomeCity: string;
  deliveryHomeCityCharge: string;
  deliveryOtherCityCharge: string;
  deliveryFreeThreshold: string;
  bkashNumber: string;
  nagadNumber: string;
  screenshotEnabled: boolean;
  maxPaymentAttempts: string;
  unpaidExpiryHours: string;
}

type FieldName = keyof Values;
type Errors = Partial<Record<FieldName, string>>;

const LABELS: Record<FieldName, string> = {
  deliveryHomeCity: 'Home city',
  deliveryHomeCityCharge: 'Home city delivery charge',
  deliveryOtherCityCharge: 'Other cities delivery charge',
  deliveryFreeThreshold: 'Free delivery from',
  bkashNumber: 'bKash merchant number',
  nagadNumber: 'Nagad merchant number',
  screenshotEnabled: 'Payment screenshots',
  maxPaymentAttempts: 'Payment attempts per order',
  unpaidExpiryHours: 'Unpaid order hold time',
};

type LoadState =
  { kind: 'loading' } | { kind: 'ready'; settings: AdminSettings } | { kind: 'error' };

function toValues(s: AdminSettings): Values {
  return {
    deliveryHomeCity: s.deliveryHomeCity,
    deliveryHomeCityCharge: String(s.deliveryHomeCityCharge),
    deliveryOtherCityCharge: String(s.deliveryOtherCityCharge),
    deliveryFreeThreshold: s.deliveryFreeThreshold === null ? '' : String(s.deliveryFreeThreshold),
    bkashNumber: s.bkashNumber ?? '',
    nagadNumber: s.nagadNumber ?? '',
    screenshotEnabled: s.screenshotEnabled,
    maxPaymentAttempts: String(s.maxPaymentAttempts),
    unpaidExpiryHours: String(s.unpaidExpiryHours),
  };
}

const compactPhone = (text: string) => text.replace(/[\s-]/g, '');

function validate(v: Values): Errors {
  const errors: Errors = {};
  const city = v.deliveryHomeCity.trim();
  if (city.length < 2 || city.length > 100) errors.deliveryHomeCity = 'Use 2 to 100 characters';
  for (const field of ['deliveryHomeCityCharge', 'deliveryOtherCityCharge'] as const) {
    if (!MONEY_PATTERN.test(v[field]) || Number(v[field]) > 100_000) {
      errors[field] = 'Enter an amount from 0 to 100,000 with up to 2 decimals';
    }
  }
  if (v.deliveryFreeThreshold !== '' && !MONEY_PATTERN.test(v.deliveryFreeThreshold)) {
    errors.deliveryFreeThreshold = 'Enter an amount with up to 2 decimals, or leave empty';
  }
  for (const field of ['bkashNumber', 'nagadNumber'] as const) {
    const text = compactPhone(v[field]);
    if (text !== '' && !PHONE_PATTERN.test(text)) {
      errors[field] = 'Enter a phone number (7 to 15 digits), or leave empty';
    }
  }
  const attempts = Number(v.maxPaymentAttempts);
  if (!Number.isInteger(attempts) || attempts < 1 || attempts > 10) {
    errors.maxPaymentAttempts = 'Enter a whole number from 1 to 10';
  }
  const hours = Number(v.unpaidExpiryHours);
  if (!Number.isInteger(hours) || hours < 1 || hours > 168) {
    errors.unpaidExpiryHours = 'Enter a whole number of hours from 1 to 168';
  }
  return errors;
}

/** Only fields that differ from what is stored, in the API's types. */
function diff(v: Values, s: AdminSettings): UpdateSettingsInput {
  const out: UpdateSettingsInput = {};
  const city = v.deliveryHomeCity.trim();
  if (city !== s.deliveryHomeCity) out.deliveryHomeCity = city;
  if (Number(v.deliveryHomeCityCharge) !== s.deliveryHomeCityCharge) {
    out.deliveryHomeCityCharge = Number(v.deliveryHomeCityCharge);
  }
  if (Number(v.deliveryOtherCityCharge) !== s.deliveryOtherCityCharge) {
    out.deliveryOtherCityCharge = Number(v.deliveryOtherCityCharge);
  }
  const threshold = v.deliveryFreeThreshold === '' ? null : Number(v.deliveryFreeThreshold);
  if (threshold !== s.deliveryFreeThreshold) out.deliveryFreeThreshold = threshold;
  const bkash = compactPhone(v.bkashNumber) || null;
  if (bkash !== s.bkashNumber) out.bkashNumber = bkash;
  const nagad = compactPhone(v.nagadNumber) || null;
  if (nagad !== s.nagadNumber) out.nagadNumber = nagad;
  if (v.screenshotEnabled !== s.screenshotEnabled) out.screenshotEnabled = v.screenshotEnabled;
  if (Number(v.maxPaymentAttempts) !== s.maxPaymentAttempts) {
    out.maxPaymentAttempts = Number(v.maxPaymentAttempts);
  }
  if (Number(v.unpaidExpiryHours) !== s.unpaidExpiryHours) {
    out.unpaidExpiryHours = Number(v.unpaidExpiryHours);
  }
  return out;
}

function show(field: FieldName, value: unknown): string {
  if (value === null || value === '') return 'not set';
  if (field === 'screenshotEnabled') return value ? 'accepted' : 'not accepted';
  if (field === 'unpaidExpiryHours') return `${value} hours`;
  if (typeof value === 'number' && field.startsWith('delivery')) return formatPrice(value);
  return String(value);
}

function describeError(err: unknown): string {
  if (!(err instanceof ApiError)) return 'Something went wrong. Please try again.';
  if (err.status === 0) return 'Unable to reach the server. Please try again.';
  if (err.status === 401) return 'Your session has expired. Please sign in again.';
  if (err.status === 403) return 'You do not have permission to do this.';
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
  hint?: ReactNode;
  children: ReactNode;
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

function Section({ title, text, children }: { title: string; text: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      <p className="mt-1 text-sm text-slate-500">{text}</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

export function SettingsContent() {
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [values, setValues] = useState<Values | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [pending, setPending] = useState<UpdateSettingsInput | null>(null);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setState({ kind: 'loading' });
    getAdminSettings()
      .then((settings) => {
        if (cancelled) return;
        setState({ kind: 'ready', settings });
        setValues(toValues(settings));
      })
      .catch(() => {
        if (!cancelled) setState({ kind: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  if (state.kind === 'loading' || (state.kind === 'ready' && !values)) {
    return (
      <div className="h-96 max-w-3xl animate-pulse rounded-xl bg-slate-200" aria-busy="true" />
    );
  }
  if (state.kind === 'error' || !values) {
    return (
      <div className="space-y-4">
        <ErrorState
          title="Could not load settings"
          message="Please check your connection and try again."
        />
        <button
          type="button"
          onClick={() => setAttempt((count) => count + 1)}
          className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          Try again
        </button>
      </div>
    );
  }

  const settings = state.settings;

  function set<K extends FieldName>(key: K, value: Values[K]) {
    setNotice(null);
    setPending(null);
    setValues((current) => (current ? { ...current, [key]: value } : current));
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  function onReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!values) return;
    const found = validate(values);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      setNotice({ kind: 'error', text: 'Please fix the highlighted fields.' });
      return;
    }
    const changes = diff(values, settings);
    if (Object.keys(changes).length === 0) {
      setNotice({ kind: 'ok', text: 'Nothing has changed.' });
      return;
    }
    setNotice(null);
    setPending(changes);
  }

  async function onConfirm() {
    if (!pending) return;
    setSaving(true);
    try {
      const saved = await updateAdminSettings(pending);
      setState({ kind: 'ready', settings: saved });
      setValues(toValues(saved));
      setPending(null);
      setNotice({
        kind: 'ok',
        text: 'Settings saved. They apply to new checkouts and orders right away.',
      });
    } catch (err) {
      setNotice({ kind: 'error', text: describeError(err) });
    } finally {
      setSaving(false);
    }
  }

  const merchantHint = (valid: boolean, stored: string | null) =>
    stored && !valid ? (
      <span className="font-medium text-amber-700">
        The stored value is not a usable number, so customers see this method as not set up.
      </span>
    ) : (
      'Customers send money to this number. Leave empty to turn this payment method off.'
    );

  return (
    <form onSubmit={onReview} noValidate className="max-w-3xl space-y-5">
      <Section
        title="Delivery"
        text="One charge for the home city and one for every other city. Shown at checkout before the order is placed."
      >
        <Field
          label={LABELS.deliveryHomeCity}
          htmlFor="deliveryHomeCity"
          error={errors.deliveryHomeCity}
        >
          <input
            id="deliveryHomeCity"
            value={values.deliveryHomeCity}
            maxLength={100}
            onChange={(e) => set('deliveryHomeCity', e.target.value)}
            className={INPUT_CLASS}
          />
        </Field>
        <Field
          label={`${LABELS.deliveryHomeCityCharge} (BDT)`}
          htmlFor="deliveryHomeCityCharge"
          error={errors.deliveryHomeCityCharge}
        >
          <input
            id="deliveryHomeCityCharge"
            inputMode="decimal"
            value={values.deliveryHomeCityCharge}
            onChange={(e) => set('deliveryHomeCityCharge', e.target.value.trim())}
            className={INPUT_CLASS}
          />
        </Field>
        <Field
          label={`${LABELS.deliveryOtherCityCharge} (BDT)`}
          htmlFor="deliveryOtherCityCharge"
          error={errors.deliveryOtherCityCharge}
        >
          <input
            id="deliveryOtherCityCharge"
            inputMode="decimal"
            value={values.deliveryOtherCityCharge}
            onChange={(e) => set('deliveryOtherCityCharge', e.target.value.trim())}
            className={INPUT_CLASS}
          />
        </Field>
        <Field
          label={`${LABELS.deliveryFreeThreshold} (BDT)`}
          htmlFor="deliveryFreeThreshold"
          error={errors.deliveryFreeThreshold}
          hint="Orders at or above this amount (after discounts) ship free. Leave empty for no free delivery."
        >
          <input
            id="deliveryFreeThreshold"
            inputMode="decimal"
            value={values.deliveryFreeThreshold}
            onChange={(e) => set('deliveryFreeThreshold', e.target.value.trim())}
            className={INPUT_CLASS}
          />
        </Field>
      </Section>

      <Section
        title="Payments (bKash / Nagad)"
        text="Customers pay to these numbers and then submit the transaction ID for you to review."
      >
        <Field
          label={LABELS.bkashNumber}
          htmlFor="bkashNumber"
          error={errors.bkashNumber}
          hint={merchantHint(settings.bkashNumberValid, settings.bkashNumber)}
        >
          <input
            id="bkashNumber"
            inputMode="tel"
            value={values.bkashNumber}
            maxLength={20}
            onChange={(e) => set('bkashNumber', e.target.value)}
            className={INPUT_CLASS}
          />
        </Field>
        <Field
          label={LABELS.nagadNumber}
          htmlFor="nagadNumber"
          error={errors.nagadNumber}
          hint={merchantHint(settings.nagadNumberValid, settings.nagadNumber)}
        >
          <input
            id="nagadNumber"
            inputMode="tel"
            value={values.nagadNumber}
            maxLength={20}
            onChange={(e) => set('nagadNumber', e.target.value)}
            className={INPUT_CLASS}
          />
        </Field>
        <Field
          label={LABELS.maxPaymentAttempts}
          htmlFor="maxPaymentAttempts"
          error={errors.maxPaymentAttempts}
          hint="How many times a customer may submit a transaction ID for one order."
        >
          <input
            id="maxPaymentAttempts"
            inputMode="numeric"
            value={values.maxPaymentAttempts}
            onChange={(e) => set('maxPaymentAttempts', e.target.value.trim())}
            className={INPUT_CLASS}
          />
        </Field>
        <div className="flex items-center gap-2 self-end pb-2">
          <input
            id="screenshotEnabled"
            type="checkbox"
            checked={values.screenshotEnabled}
            onChange={(e) => set('screenshotEnabled', e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
          />
          <label htmlFor="screenshotEnabled" className="text-sm font-medium text-slate-700">
            Accept payment screenshots (optional for customers)
          </label>
        </div>
      </Section>

      <Section
        title="Orders"
        text="Unpaid orders hold their stock for this long, then are cancelled automatically and the stock is released."
      >
        <Field
          label={`${LABELS.unpaidExpiryHours} (hours)`}
          htmlFor="unpaidExpiryHours"
          error={errors.unpaidExpiryHours}
          hint="Paused while a payment is under review. 1 to 168 hours."
        >
          <input
            id="unpaidExpiryHours"
            inputMode="numeric"
            value={values.unpaidExpiryHours}
            onChange={(e) => set('unpaidExpiryHours', e.target.value.trim())}
            className={INPUT_CLASS}
          />
        </Field>
      </Section>

      {notice ? (
        <p
          role={notice.kind === 'error' ? 'alert' : 'status'}
          className={`rounded-lg px-3 py-2 text-sm ${
            notice.kind === 'error' ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-800'
          }`}
        >
          {notice.text}
        </p>
      ) : null}

      {pending ? (
        <div
          role="group"
          aria-label="Confirm changes"
          className="rounded-xl border border-amber-300 bg-amber-50 p-4"
        >
          <p className="text-sm font-semibold text-amber-900">Please check these changes:</p>
          <ul className="mt-2 space-y-1 text-sm text-amber-900">
            {(Object.keys(pending) as FieldName[]).map((field) => (
              <li key={field}>
                <span className="font-medium">{LABELS[field]}:</span>{' '}
                {show(field, (settings as unknown as Record<string, unknown>)[field])} &rarr;{' '}
                <span className="font-semibold">
                  {show(field, (pending as Record<string, unknown>)[field])}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex gap-3">
            <button
              type="button"
              onClick={() => void onConfirm()}
              disabled={saving}
              className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Yes, save changes'}
            </button>
            <button
              type="button"
              onClick={() => setPending(null)}
              disabled={saving}
              className="rounded-lg border border-slate-300 bg-white px-5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Keep editing
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <button
            type="submit"
            className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Review changes
          </button>
          <button
            type="button"
            onClick={() => {
              setValues(toValues(settings));
              setErrors({});
              setNotice(null);
            }}
            className="text-sm font-medium text-slate-600 hover:text-slate-800"
          >
            Reset
          </button>
        </div>
      )}
    </form>
  );
}
