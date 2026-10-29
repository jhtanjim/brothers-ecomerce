'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { useCart } from '@/components/cart/CartProvider';
import { CheckoutField } from '@/components/checkout/CheckoutField';
import { CheckoutSummary } from '@/components/checkout/CheckoutSummary';
import { CouponBox } from '@/components/checkout/CouponBox';
import { createAddress, getAddresses } from '@/lib/api/addresses';
import { ApiError } from '@/lib/api/client';
import { createOrder, getOrderQuote } from '@/lib/api/orders';
import type {
  AddressView,
  AuthUser,
  CartView,
  CreateOrderInput,
  OrderQuote,
  PaymentMethod,
  ValidateCouponResult,
} from '@/lib/api/types';

/** Wait for a pause in typing before asking the backend for a new delivery quote. */
const QUOTE_DELAY_MS = 400;

const NOTES_MAX = 500;
/** Same rule as the backend DTOs (the backend stays the authority). */
const PHONE_PATTERN = /^\+?[0-9]{7,15}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PAYMENT_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: 'BKASH', label: 'bKash' },
  { value: 'NAGAD', label: 'Nagad' },
];

interface FormValues {
  fullName: string;
  phone: string;
  email: string;
  addressLine: string;
  city: string;
  area: string;
  postalCode: string;
  notes: string;
}

type FieldName = keyof FormValues;
type FieldErrors = Partial<Record<FieldName | 'paymentMethod', string>>;

interface FormError {
  text: string;
  details: string[];
  /** The cart changed under the customer (stock, availability, emptied): offer a way back. */
  cartProblem: boolean;
}

const EMPTY_ADDRESS = {
  fullName: '',
  phone: '',
  addressLine: '',
  city: '',
  area: '',
  postalCode: '',
};

function addressFields(address: AddressView) {
  return {
    fullName: address.fullName,
    phone: address.phone,
    addressLine: address.addressLine,
    city: address.city,
    area: address.area,
    postalCode: address.postalCode,
  };
}

function normalizePhone(value: string): string {
  return value.replace(/[\s-]/g, '');
}

function lengthError(value: string, label: string, min: number, max: number): string | undefined {
  const length = value.trim().length;
  if (length < min) {
    return min === 1 ? `${label} is required` : `${label} must be at least ${min} characters`;
  }
  if (length > max) return `${label} must be at most ${max} characters`;
  return undefined;
}

function validate(values: FormValues, paymentMethod: PaymentMethod | null): FieldErrors {
  const errors: FieldErrors = {};
  const checks: [FieldName, string | undefined][] = [
    ['fullName', lengthError(values.fullName, 'Full name', 2, 100)],
    ['addressLine', lengthError(values.addressLine, 'Address', 3, 255)],
    ['city', lengthError(values.city, 'City', 2, 100)],
    ['area', lengthError(values.area, 'Area', 2, 100)],
    ['postalCode', lengthError(values.postalCode, 'Postal code', 1, 20)],
  ];
  for (const [name, message] of checks) {
    if (message) errors[name] = message;
  }
  if (!PHONE_PATTERN.test(normalizePhone(values.phone))) {
    errors.phone = 'Enter a valid phone number (7 to 15 digits)';
  }
  const email = values.email.trim();
  if (!EMAIL_PATTERN.test(email) || email.length > 254) {
    errors.email = 'Enter a valid email address';
  }
  if (!paymentMethod) errors.paymentMethod = 'Choose a payment method';
  return errors;
}

/** One key per checkout visit; reused on retries so the server never creates a second order. */
function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function describeError(err: unknown): FormError {
  const generic = { details: [] as string[], cartProblem: false };
  if (!(err instanceof ApiError)) {
    return { ...generic, text: 'Something went wrong. Please try again.' };
  }
  if (err.status === 0) {
    return {
      ...generic,
      text: 'Unable to reach the server. Please check your connection and try again.',
    };
  }
  if (err.status === 401) {
    return { ...generic, text: 'Your session has expired. Please sign in again.' };
  }
  if (err.status === 429) {
    return { ...generic, text: 'Too many attempts. Please wait a minute and try again.' };
  }
  if (err.code.startsWith('COUPON_')) {
    return { text: err.message, details: [], cartProblem: false };
  }
  if (err.status === 409 || err.code === 'CART_EMPTY') {
    return { text: err.message, details: [], cartProblem: true };
  }
  if (err.code === 'VALIDATION_ERROR') {
    const details = Array.isArray(err.details)
      ? err.details.filter((item): item is string => typeof item === 'string')
      : [];
    return {
      text: 'Some details were not accepted. Please check the form.',
      details,
      cartProblem: false,
    };
  }
  return { ...generic, text: err.message };
}

interface CheckoutFormProps {
  user: AuthUser;
  cart: CartView;
  onPlaced: (orderId: string) => void;
}

export function CheckoutForm({ user, cart, onPlaced }: CheckoutFormProps) {
  const { reload } = useCart();
  const [values, setValues] = useState<FormValues>({
    ...EMPTY_ADDRESS,
    fullName: user.name,
    email: user.email,
    notes: '',
  });
  const [addresses, setAddresses] = useState<AddressView[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [saveAddress, setSaveAddress] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<FormError | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [coupon, setCoupon] = useState<ValidateCouponResult | null>(null);
  const [quote, setQuote] = useState<OrderQuote | null>(null);
  const [quoteState, setQuoteState] = useState<'idle' | 'loading' | 'error'>('idle');

  const quoteCity = values.city.trim();
  const quoteCoupon = coupon?.code ?? '';
  // Re-quote when the cart itself changes (quantities, prices).
  const cartKey = `${cart.itemCount}:${cart.subtotal}`;
  useEffect(() => {
    if (quoteCity.length < 2) {
      setQuote(null);
      setQuoteState('idle');
      return;
    }
    let cancelled = false;
    setQuoteState('loading');
    const timer = setTimeout(() => {
      getOrderQuote({ city: quoteCity, ...(quoteCoupon ? { couponCode: quoteCoupon } : {}) })
        .then((result) => {
          if (cancelled) return;
          setQuote(result);
          setQuoteState('idle');
        })
        .catch(() => {
          if (!cancelled) setQuoteState('error');
        });
    }, QUOTE_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [quoteCity, quoteCoupon, cartKey]);

  // True once the customer has typed or chosen something, so late-arriving saved addresses never overwrite it.
  const touchedRef = useRef(false);
  const keyRef = useRef<string | null>(null);
  const submittingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    getAddresses()
      .then((list) => {
        if (cancelled) return;
        setAddresses(list);
        // The API lists the default address first.
        const preferred = list[0];
        if (preferred && !touchedRef.current) {
          setValues((current) => ({ ...current, ...addressFields(preferred) }));
          setSelectedId(preferred.id);
        }
      })
      .catch(() => {
        // Saved addresses are optional: the customer can always type the address.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function clearFieldError(name: string) {
    setFieldErrors((current) => {
      if (!(name in current)) return current;
      const next = { ...current };
      delete next[name as FieldName];
      return next;
    });
  }

  function onChange(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = event.target;
    touchedRef.current = true;
    setValues((current) => ({ ...current, [name]: value }));
    clearFieldError(name);
  }

  function onSelectAddress(event: ChangeEvent<HTMLSelectElement>) {
    const id = event.target.value;
    touchedRef.current = true;
    setSelectedId(id);
    setFieldErrors({});
    const chosen = addresses.find((address) => address.id === id);
    setValues((current) => ({
      ...current,
      ...(chosen ? addressFields(chosen) : { ...EMPTY_ADDRESS, fullName: user.name }),
    }));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;

    const found = validate(values, paymentMethod);
    setFieldErrors(found);
    if (Object.keys(found).length > 0 || !paymentMethod) {
      setFormError({ text: 'Please fix the highlighted fields.', details: [], cartProblem: false });
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setFormError(null);
    if (!keyRef.current) keyRef.current = newIdempotencyKey();

    const notes = values.notes.trim();
    const payload: CreateOrderInput = {
      fullName: values.fullName.trim(),
      phone: normalizePhone(values.phone),
      email: values.email.trim(),
      addressLine: values.addressLine.trim(),
      city: values.city.trim(),
      area: values.area.trim(),
      postalCode: values.postalCode.trim(),
      paymentMethod,
      ...(notes ? { notes } : {}),
      ...(coupon ? { couponCode: coupon.code } : {}),
    };

    try {
      const order = await createOrder(payload, keyRef.current);

      if (saveAddress && selectedId === '') {
        try {
          await createAddress({
            fullName: payload.fullName,
            phone: payload.phone,
            addressLine: payload.addressLine,
            city: payload.city,
            area: payload.area,
            postalCode: payload.postalCode,
          });
        } catch {
          // The order is placed; failing to save the address (for example the limit) is not worth reporting.
        }
      }

      onPlaced(order.id);
    } catch (err) {
      const described = describeError(err);
      setFormError(described);
      if (err instanceof ApiError && err.code.startsWith('COUPON_')) setCoupon(null);
      if (described.cartProblem) void reload();
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-8 lg:grid-cols-3 lg:items-start">
      <div className="space-y-8 lg:col-span-2">
        {cart.hasIssues ? (
          <p role="status" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Some items in your cart need attention before you can place the order.{' '}
            <Link href="/cart" className="font-medium underline">
              Review your cart
            </Link>
          </p>
        ) : null}

        <section aria-labelledby="shipping-heading" className="space-y-4">
          <h2 id="shipping-heading" className="text-lg font-semibold text-slate-900">
            Shipping details
          </h2>

          {addresses.length > 0 ? (
            <div>
              <label
                htmlFor="savedAddress"
                className="mb-1 block text-sm font-medium text-slate-700"
              >
                Use a saved address
              </label>
              <select
                id="savedAddress"
                value={selectedId}
                onChange={onSelectAddress}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
              >
                {addresses.map((address) => (
                  <option key={address.id} value={address.id}>
                    {address.fullName}, {address.addressLine}, {address.area}, {address.city}
                    {address.isDefault ? ' (default)' : ''}
                  </option>
                ))}
                <option value="">Enter a new address</option>
              </select>
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <CheckoutField
              label="Full name"
              name="fullName"
              autoComplete="name"
              maxLength={100}
              value={values.fullName}
              onChange={onChange}
              error={fieldErrors.fullName}
            />
            <CheckoutField
              label="Phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              maxLength={20}
              value={values.phone}
              onChange={onChange}
              error={fieldErrors.phone}
            />
            <div className="sm:col-span-2">
              <CheckoutField
                label="Email"
                name="email"
                type="email"
                autoComplete="email"
                maxLength={254}
                value={values.email}
                onChange={onChange}
                error={fieldErrors.email}
              />
            </div>
            <div className="sm:col-span-2">
              <CheckoutField
                label="Address"
                name="addressLine"
                autoComplete="street-address"
                maxLength={255}
                value={values.addressLine}
                onChange={onChange}
                error={fieldErrors.addressLine}
              />
            </div>
            <CheckoutField
              label="City"
              name="city"
              autoComplete="address-level2"
              maxLength={100}
              value={values.city}
              onChange={onChange}
              error={fieldErrors.city}
            />
            <CheckoutField
              label="Area"
              name="area"
              maxLength={100}
              value={values.area}
              onChange={onChange}
              error={fieldErrors.area}
            />
            <CheckoutField
              label="Postal code"
              name="postalCode"
              autoComplete="postal-code"
              maxLength={20}
              value={values.postalCode}
              onChange={onChange}
              error={fieldErrors.postalCode}
            />
          </div>

          <div>
            <label htmlFor="notes" className="mb-1 block text-sm font-medium text-slate-700">
              Order notes (optional)
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={3}
              maxLength={NOTES_MAX}
              value={values.notes}
              onChange={onChange}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
            />
          </div>

          {selectedId === '' ? (
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={saveAddress}
                onChange={(event) => setSaveAddress(event.target.checked)}
                className="h-4 w-4 accent-brand-600"
              />
              Save this address for next time
            </label>
          ) : null}
        </section>

        <fieldset>
          <legend className="text-lg font-semibold text-slate-900">Payment method</legend>
          <p className="mt-1 text-sm text-slate-600">
            You pay manually with the method you choose. Your order is confirmed once the payment is
            verified.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {PAYMENT_OPTIONS.map((option) => (
              <label
                key={option.value}
                className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium ${
                  paymentMethod === option.value
                    ? 'border-brand-600 bg-brand-50 text-brand-900'
                    : 'border-slate-300 text-slate-700 hover:border-slate-400'
                }`}
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  value={option.value}
                  checked={paymentMethod === option.value}
                  onChange={() => {
                    setPaymentMethod(option.value);
                    clearFieldError('paymentMethod');
                  }}
                  className="h-4 w-4 accent-brand-600"
                />
                {option.label}
              </label>
            ))}
          </div>
          {fieldErrors.paymentMethod ? (
            <p role="alert" className="mt-2 text-xs text-rose-600">
              {fieldErrors.paymentMethod}
            </p>
          ) : null}
        </fieldset>

        <CouponBox applied={coupon} onApplied={setCoupon} disabled={submitting} />

        {formError ? (
          <div role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
            <p>{formError.text}</p>
            {formError.details.length > 0 ? (
              <ul className="mt-1 list-disc pl-5">
                {formError.details.map((detail) => (
                  <li key={detail}>{detail}</li>
                ))}
              </ul>
            ) : null}
            {formError.cartProblem ? (
              <p className="mt-1">
                <Link href="/cart" className="font-medium underline">
                  Review your cart
                </Link>
              </p>
            ) : null}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={submitting || cart.hasIssues}
          className="w-full rounded-lg bg-brand-600 px-6 py-3 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          {submitting ? 'Placing order...' : 'Place order'}
        </button>
      </div>

      <CheckoutSummary
        cart={cart}
        coupon={coupon}
        quote={quote}
        quoteState={quoteState}
        city={values.city}
      />
    </form>
  );
}
