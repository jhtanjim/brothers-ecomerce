'use client';

import { useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { CheckoutField } from '@/components/checkout/CheckoutField';
import { paymentMethodLabel } from '@/components/order/StatusBadges';
import { ApiError } from '@/lib/api/client';
import { createPayment } from '@/lib/api/payments';
import type { OrderPaymentInfo, PaymentMethod, PaymentStatus } from '@/lib/api/types';
import { formatDateTime } from '@/lib/format-date';
import { formatPrice } from '@/lib/format';

/** Same rules as the backend (the backend stays the authority). */
const TRANSACTION_PATTERN = /^[A-Z0-9]{6,30}$/;
const PHONE_PATTERN = /^\+?[0-9]{7,15}$/;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** Server answers that mean the order or payment changed under the customer: refresh the page data. */
const STATE_CHANGED_CODES = [
  'ORDER_NOT_PAYABLE',
  'ORDER_EXPIRED',
  'PAYMENT_NOT_SUBMITTABLE',
  'PAYMENT_ATTEMPTS_EXHAUSTED',
  'PAYMENT_NOT_FOUND',
];

type FieldErrors = Partial<Record<'transactionId' | 'senderPhone' | 'screenshot', string>>;

interface FormError {
  text: string;
  details: string[];
}

function normalizePhone(value: string): string {
  return value.replace(/[\s-]/g, '');
}

function screenshotError(file: File): string | undefined {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) return 'The screenshot must be a JPEG, PNG or WebP image';
  if (file.size > MAX_IMAGE_BYTES) return 'The screenshot must be 5 MB or smaller';
  return undefined;
}

function describeError(err: unknown): FormError {
  if (!(err instanceof ApiError)) return { text: 'Something went wrong. Please try again.', details: [] };
  if (err.status === 0) {
    return { text: 'Unable to reach the server. Please check your connection and try again.', details: [] };
  }
  if (err.status === 401) return { text: 'Your session has expired. Please sign in again.', details: [] };
  if (err.status === 429) return { text: 'Too many attempts. Please wait a minute and try again.', details: [] };
  if (err.code === 'VALIDATION_ERROR') {
    const details = Array.isArray(err.details)
      ? err.details.filter((item): item is string => typeof item === 'string')
      : [];
    return { text: 'Some details were not accepted. Please check the form.', details };
  }
  return { text: err.message, details: [] };
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void copy()}
      className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
    >
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

interface PaymentPanelProps {
  orderId: string;
  method: PaymentMethod;
  amount: string;
  expiresAt: string | null;
  paymentStatus: PaymentStatus;
  info: OrderPaymentInfo;
  /** Called after a successful submit (and when the server says the state changed): reload the order. */
  onSubmitted: () => void;
}

export function PaymentPanel({
  orderId,
  method,
  amount,
  expiresAt,
  paymentStatus,
  info,
  onSubmitted,
}: PaymentPanelProps) {
  const [transactionId, setTransactionId] = useState('');
  const [senderPhone, setSenderPhone] = useState('');
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<FormError | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const methodLabel = paymentMethodLabel(method);
  const attemptsLeft = Math.max(info.maxAttempts - info.attemptsUsed, 0);
  const latest = info.latestSubmission;

  function clearFieldError(name: keyof FieldErrors) {
    setFieldErrors((current) => {
      if (!(name in current)) return current;
      const next = { ...current };
      delete next[name];
      return next;
    });
  }

  function onScreenshotChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    if (!file) {
      setScreenshot(null);
      clearFieldError('screenshot');
      return;
    }
    const problem = screenshotError(file);
    if (problem) {
      setFieldErrors((current) => ({ ...current, screenshot: problem }));
      setScreenshot(null);
      event.target.value = '';
      return;
    }
    clearFieldError('screenshot');
    setScreenshot(file);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;

    const normalizedTransaction = transactionId.trim().toUpperCase();
    const normalizedPhone = normalizePhone(senderPhone);
    const errors: FieldErrors = {};
    if (!TRANSACTION_PATTERN.test(normalizedTransaction)) {
      errors.transactionId = 'Enter the transaction ID (6 to 30 letters or digits)';
    }
    if (!PHONE_PATTERN.test(normalizedPhone)) {
      errors.senderPhone = 'Enter the phone number you paid from (7 to 15 digits)';
    }
    if (screenshot) {
      const problem = screenshotError(screenshot);
      if (problem) errors.screenshot = problem;
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setFormError({ text: 'Please fix the highlighted fields.', details: [] });
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setFormError(null);
    try {
      await createPayment({
        orderId,
        transactionId: normalizedTransaction,
        senderPhone: normalizedPhone,
        screenshot,
      });
      onSubmitted();
    } catch (err) {
      setFormError(describeError(err));
      if (err instanceof ApiError && STATE_CHANGED_CODES.includes(err.code)) onSubmitted();
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  const cardClass = 'rounded-xl border border-slate-200 bg-white p-5';

  // 1. Proof submitted, waiting for the admin.
  if (paymentStatus === 'PENDING') {
    return (
      <section aria-labelledby="payment-heading" className={cardClass}>
        <h2 id="payment-heading" className="text-lg font-semibold text-slate-900">
          Payment under review
        </h2>
        <p role="status" className="mt-2 text-sm text-slate-700">
          Thank you. We received your {methodLabel} payment details and will verify them shortly. Your
          order will move forward as soon as the payment is approved.
        </p>
        {latest ? (
          <dl className="mt-3 space-y-1 text-sm">
            <div className="flex flex-wrap gap-x-2">
              <dt className="text-slate-600">Transaction ID:</dt>
              <dd className="font-mono font-medium text-slate-900">{latest.transactionId}</dd>
            </div>
            <div className="flex flex-wrap gap-x-2">
              <dt className="text-slate-600">Submitted:</dt>
              <dd className="text-slate-900">{formatDateTime(latest.submittedAt)}</dd>
            </div>
          </dl>
        ) : null}
        {latest?.screenshotUrl ? (
          <p className="mt-3 text-sm">
            <a
              href={latest.screenshotUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-indigo-600 underline hover:text-indigo-700"
            >
              View your screenshot
            </a>
          </p>
        ) : null}
      </section>
    );
  }

  // 1b. The hold has run out (the server rejects submissions for expired orders).
  if (expiresAt !== null && new Date(expiresAt).getTime() <= Date.now()) {
    return (
      <section aria-labelledby="payment-heading" className={cardClass}>
        <h2 id="payment-heading" className="text-lg font-semibold text-slate-900">
          This order has expired
        </h2>
        <p role="status" className="mt-2 text-sm text-slate-700">
          The payment window for this order has passed, so it can no longer be paid. Please place a new
          order, or contact support if you already sent the money.
        </p>
      </section>
    );
  }
  // 2. The shop has not set its payment number yet.
  if (info.merchantNumber === null) {
    return (
      <section aria-labelledby="payment-heading" className={cardClass}>
        <h2 id="payment-heading" className="text-lg font-semibold text-slate-900">
          Payment is not set up yet
        </h2>
        <p role="status" className="mt-2 text-sm text-slate-700">
          We cannot accept {methodLabel} payments for this order right now. Please check back soon or
          contact support. Your order is saved.
        </p>
      </section>
    );
  }

  // 3. All attempts used.
  if (attemptsLeft === 0) {
    return (
      <section aria-labelledby="payment-heading" className={cardClass}>
        <h2 id="payment-heading" className="text-lg font-semibold text-slate-900">
          Payment attempts used up
        </h2>
        {latest?.status === 'REJECTED' && latest.rejectionReason ? (
          <p className="mt-2 text-sm text-rose-700">Last rejection: {latest.rejectionReason}</p>
        ) : null}
        <p role="status" className="mt-2 text-sm text-slate-700">
          You have used all payment attempts for this order. Please contact support and mention your
          order number.
        </p>
      </section>
    );
  }

  // 4. Instructions and the form (first payment, or a resubmission after a rejection).
  const rejected = paymentStatus === 'REJECTED';
  return (
    <section aria-labelledby="payment-heading" className={cardClass}>
      <h2 id="payment-heading" className="text-lg font-semibold text-slate-900">
        {rejected ? 'Submit your payment again' : `Pay with ${methodLabel}`}
      </h2>

      {rejected ? (
        <div role="alert" className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
          <p className="font-medium">Your last payment was not approved.</p>
          {latest?.rejectionReason ? <p className="mt-1">Reason: {latest.rejectionReason}</p> : null}
          <p className="mt-1">
            {attemptsLeft} {attemptsLeft === 1 ? 'attempt' : 'attempts'} left.
          </p>
        </div>
      ) : null}

      <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-slate-700">
        <li>Open your {methodLabel} app and choose Send Money.</li>
        <li>Send exactly {formatPrice(amount)} to the number below.</li>
        <li>Enter the transaction ID and your sender number here.</li>
      </ol>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-50 px-4 py-3">
        <div>
          <p className="text-xs text-slate-500">{methodLabel} number</p>
          <p className="font-mono text-base font-semibold text-slate-900">{info.merchantNumber}</p>
        </div>
        <CopyButton text={info.merchantNumber} />
      </div>
      <p className="mt-2 text-sm text-slate-700">
        Amount to pay: <span className="font-semibold text-slate-900">{formatPrice(amount)}</span>
      </p>
      {expiresAt ? (
        <p className="mt-1 text-xs text-slate-500">Your items are reserved until {formatDateTime(expiresAt)}.</p>
      ) : null}

      <form onSubmit={onSubmit} noValidate className="mt-5 space-y-4">
        <CheckoutField
          label="Transaction ID"
          name="transactionId"
          autoComplete="off"
          autoCapitalize="characters"
          maxLength={30}
          value={transactionId}
          onChange={(event) => {
            setTransactionId(event.target.value.toUpperCase());
            clearFieldError('transactionId');
          }}
          error={fieldErrors.transactionId}
        />
        <CheckoutField
          label="Phone number you paid from"
          name="senderPhone"
          type="tel"
          autoComplete="tel"
          maxLength={20}
          value={senderPhone}
          onChange={(event) => {
            setSenderPhone(event.target.value);
            clearFieldError('senderPhone');
          }}
          error={fieldErrors.senderPhone}
        />

        {info.screenshotEnabled ? (
          <div>
            <label htmlFor="screenshot" className="mb-1 block text-sm font-medium text-slate-700">
              Payment screenshot (optional)
            </label>
            <input
              ref={fileInputRef}
              id="screenshot"
              name="screenshot"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={onScreenshotChange}
              aria-invalid={fieldErrors.screenshot ? true : undefined}
              aria-describedby={fieldErrors.screenshot ? 'screenshot-error' : 'screenshot-hint'}
              className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
            />
            {fieldErrors.screenshot ? (
              <p id="screenshot-error" className="mt-1 text-xs text-rose-600">
                {fieldErrors.screenshot}
              </p>
            ) : (
              <p id="screenshot-hint" className="mt-1 text-xs text-slate-500">
                JPEG, PNG or WebP, up to 5 MB.
              </p>
            )}
          </div>
        ) : null}

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
          </div>
        ) : null}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          {submitting ? 'Submitting...' : 'Submit payment details'}
        </button>
      </form>
    </section>
  );
}