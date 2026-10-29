'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { createAddress, deleteAddress, getAddresses, updateAddress } from '@/lib/api/addresses';
import { ApiError } from '@/lib/api/client';
import type { AddressInput, AddressView } from '@/lib/api/types';

const PAGE_PATH = '/account/addresses';
/** Same limit as MAX_ADDRESSES_PER_USER in the backend (which enforces it anyway). */
const MAX_ADDRESSES = 10;
const PHONE_PATTERN = /^\+?[0-9]{7,15}$/;
const INPUT_CLASS =
  'h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100';

type FieldName = keyof Omit<AddressInput, 'isDefault'>;
type Values = Record<FieldName, string>;
type Errors = Partial<Record<FieldName, string>>;

const EMPTY: Values = {
  fullName: '',
  phone: '',
  addressLine: '',
  city: '',
  area: '',
  postalCode: '',
};

const FIELDS: { name: FieldName; label: string; min: number; max: number; wide?: boolean }[] = [
  { name: 'fullName', label: 'Full name', min: 2, max: 100 },
  { name: 'phone', label: 'Phone', min: 7, max: 20 },
  { name: 'addressLine', label: 'Address (house, road)', min: 3, max: 255, wide: true },
  { name: 'city', label: 'City', min: 2, max: 100 },
  { name: 'area', label: 'Area', min: 2, max: 100 },
  { name: 'postalCode', label: 'Postal code', min: 1, max: 20 },
];

type LoadState = { kind: 'loading' } | { kind: 'ready'; items: AddressView[] } | { kind: 'error' };

/** Editor state: closed, adding a new address, or editing an existing one. */
type Editor = { mode: 'closed' } | { mode: 'new' } | { mode: 'edit'; id: string };

const compactPhone = (text: string) => text.replace(/[\s-]/g, '');

function validate(values: Values): Errors {
  const errors: Errors = {};
  for (const field of FIELDS) {
    const text = values[field.name].trim();
    if (field.name === 'phone') {
      if (!PHONE_PATTERN.test(compactPhone(text))) {
        errors.phone = 'Enter a valid phone number (7 to 15 digits)';
      }
    } else if (text.length < field.min || text.length > field.max) {
      errors[field.name] = `Use ${field.min} to ${field.max} characters`;
    }
  }
  return errors;
}

function describeError(err: unknown): string {
  if (!(err instanceof ApiError)) return 'Something went wrong. Please try again.';
  if (err.status === 0) return 'Unable to reach the server. Please try again.';
  if (err.status === 401) return 'Your session has expired. Please sign in again.';
  return err.message;
}

function AddressForm({
  initial,
  submitLabel,
  busy,
  error,
  onSubmit,
  onCancel,
}: {
  initial: Values;
  submitLabel: string;
  busy: boolean;
  error: string | null;
  onSubmit: (values: Values, makeDefault: boolean) => void;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<Values>(initial);
  const [makeDefault, setMakeDefault] = useState(false);
  const [errors, setErrors] = useState<Errors>({});

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const found = validate(values);
    setErrors(found);
    if (Object.keys(found).length === 0) onSubmit(values, makeDefault);
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {FIELDS.map((field) => {
          const id = `address-${field.name}`;
          const message = errors[field.name];
          return (
            <div key={field.name} className={field.wide ? 'sm:col-span-2' : undefined}>
              <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-700">
                {field.label}
              </label>
              <input
                id={id}
                value={values[field.name]}
                maxLength={field.max}
                inputMode={field.name === 'phone' ? 'tel' : undefined}
                autoComplete={
                  field.name === 'fullName'
                    ? 'name'
                    : field.name === 'phone'
                      ? 'tel'
                      : field.name === 'addressLine'
                        ? 'street-address'
                        : field.name === 'postalCode'
                          ? 'postal-code'
                          : field.name === 'city'
                            ? 'address-level2'
                            : 'address-level3'
                }
                aria-invalid={message ? true : undefined}
                aria-describedby={message ? `${id}-error` : undefined}
                onChange={(event) => {
                  const value = event.target.value;
                  setValues((current) => ({ ...current, [field.name]: value }));
                  setErrors((current) => {
                    if (!current[field.name]) return current;
                    const next = { ...current };
                    delete next[field.name];
                    return next;
                  });
                }}
                className={`${INPUT_CLASS} ${message ? 'border-rose-400' : ''}`}
              />
              {message ? (
                <p id={`${id}-error`} className="mt-1 text-xs text-rose-600">
                  {message}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={makeDefault}
          onChange={(event) => setMakeDefault(event.target.checked)}
          className="h-4 w-4 rounded border-slate-300 text-brand-600"
        />
        Use as my default address at checkout
      </label>
      {error ? (
        <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={busy}
          className="h-11 rounded-full bg-brand-600 px-6 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {busy ? 'Saving...' : submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="h-11 rounded-full border border-slate-300 px-6 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export function AddressBookContent() {
  const router = useRouter();
  const { status: authStatus } = useAuth();
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [editor, setEditor] = useState<Editor>({ mode: 'closed' });
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (authStatus === 'unauthenticated') {
      router.replace(`/login?next=${encodeURIComponent(PAGE_PATH)}`);
    }
  }, [authStatus, router]);

  useEffect(() => {
    if (authStatus !== 'authenticated') return;
    let cancelled = false;
    setState({ kind: 'loading' });
    getAddresses()
      .then((items) => {
        if (!cancelled) setState({ kind: 'ready', items });
      })
      .catch(() => {
        if (!cancelled) setState({ kind: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [authStatus, attempt]);

  const reload = () => setAttempt((count) => count + 1);

  async function run(action: () => Promise<unknown>, successText: string) {
    setBusy(true);
    setNotice(null);
    setFormError(null);
    try {
      await action();
      setNotice({ kind: 'ok', text: successText });
      setEditor({ mode: 'closed' });
      setConfirmId(null);
      reload();
    } catch (err) {
      if (editor.mode === 'closed') setNotice({ kind: 'error', text: describeError(err) });
      else setFormError(describeError(err));
    } finally {
      setBusy(false);
    }
  }

  function toInput(values: Values): Omit<AddressInput, 'isDefault'> {
    return {
      fullName: values.fullName.trim(),
      phone: compactPhone(values.phone.trim()),
      addressLine: values.addressLine.trim(),
      city: values.city.trim(),
      area: values.area.trim(),
      postalCode: values.postalCode.trim(),
    };
  }

  if (authStatus !== 'authenticated' || state.kind === 'loading') {
    return <div className="h-48 animate-pulse rounded-2xl bg-slate-100" aria-busy="true" />;
  }
  if (state.kind === 'error') {
    return (
      <div className="space-y-4">
        <ErrorState
          title="Could not load your addresses"
          message="Please check your connection and try again."
        />
        <button
          type="button"
          onClick={reload}
          className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          Try again
        </button>
      </div>
    );
  }

  const items = state.items;
  const full = items.length >= MAX_ADDRESSES;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">
          Saved addresses can be picked at checkout. {items.length} of {MAX_ADDRESSES} used.
        </p>
        {editor.mode === 'closed' ? (
          <button
            type="button"
            disabled={full}
            title={full ? `You can save up to ${MAX_ADDRESSES} addresses` : undefined}
            onClick={() => {
              setFormError(null);
              setNotice(null);
              setEditor({ mode: 'new' });
            }}
            className="h-11 rounded-full bg-brand-600 px-5 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Add address
          </button>
        ) : null}
      </div>

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

      {editor.mode === 'new' ? (
        <AddressForm
          initial={EMPTY}
          submitLabel="Save address"
          busy={busy}
          error={formError}
          onCancel={() => setEditor({ mode: 'closed' })}
          onSubmit={(values, makeDefault) =>
            void run(
              () =>
                createAddress({ ...toInput(values), ...(makeDefault ? { isDefault: true } : {}) }),
              'Address saved.',
            )
          }
        />
      ) : null}

      {items.length === 0 && editor.mode !== 'new' ? (
        <EmptyState
          title="No saved addresses yet"
          message="Add one now, or save it the next time you check out."
        />
      ) : null}

      <ul className="grid gap-4 sm:grid-cols-2">
        {items.map((address) =>
          editor.mode === 'edit' && editor.id === address.id ? (
            <li key={address.id} className="sm:col-span-2">
              <AddressForm
                initial={{
                  fullName: address.fullName,
                  phone: address.phone,
                  addressLine: address.addressLine,
                  city: address.city,
                  area: address.area,
                  postalCode: address.postalCode,
                }}
                submitLabel="Save changes"
                busy={busy}
                error={formError}
                onCancel={() => setEditor({ mode: 'closed' })}
                onSubmit={(values, makeDefault) =>
                  void run(
                    () =>
                      updateAddress(address.id, {
                        ...toInput(values),
                        ...(makeDefault ? { isDefault: true } : {}),
                      }),
                    'Address updated.',
                  )
                }
              />
            </li>
          ) : (
            <li
              key={address.id}
              className={`flex flex-col rounded-2xl border bg-white p-5 ${
                address.isDefault ? 'border-brand-300 ring-1 ring-brand-200' : 'border-slate-200'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <p className="font-semibold text-slate-900">{address.fullName}</p>
                {address.isDefault ? (
                  <span className="shrink-0 rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-700">
                    Default
                  </span>
                ) : null}
              </div>
              <address className="mt-2 text-sm not-italic leading-relaxed text-slate-600">
                {address.addressLine}
                <br />
                {address.area}, {address.city} {address.postalCode}
                <br />
                {address.phone}
              </address>
              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                {confirmId === address.id ? (
                  <>
                    <span className="text-slate-700">Delete this address?</span>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void run(() => deleteAddress(address.id), 'Address deleted.')}
                      className="min-h-11 font-semibold text-rose-600 hover:text-rose-700 disabled:opacity-60"
                    >
                      {busy ? 'Deleting...' : 'Yes, delete'}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setConfirmId(null)}
                      className="min-h-11 font-semibold text-slate-600 hover:text-slate-800"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      disabled={busy || editor.mode !== 'closed'}
                      onClick={() => {
                        setFormError(null);
                        setNotice(null);
                        setEditor({ mode: 'edit', id: address.id });
                      }}
                      className="min-h-11 font-semibold text-brand-700 hover:text-brand-800 disabled:opacity-50"
                    >
                      Edit
                    </button>
                    {!address.isDefault ? (
                      <button
                        type="button"
                        disabled={busy || editor.mode !== 'closed'}
                        onClick={() =>
                          void run(
                            () => updateAddress(address.id, { isDefault: true }),
                            'Default address updated.',
                          )
                        }
                        className="min-h-11 font-semibold text-slate-700 hover:text-slate-900 disabled:opacity-50"
                      >
                        Make default
                      </button>
                    ) : null}
                    <button
                      type="button"
                      disabled={busy || editor.mode !== 'closed'}
                      onClick={() => setConfirmId(address.id)}
                      className="min-h-11 font-semibold text-rose-600 hover:text-rose-700 disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            </li>
          ),
        )}
      </ul>
      <p className="text-xs text-slate-500">
        Changing or deleting an address does not change orders you have already placed.
      </p>
    </div>
  );
}
