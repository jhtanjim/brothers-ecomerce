'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import {
  OrderStatusBadge,
  PaymentStatusBadge,
  orderStatusLabel,
  paymentMethodLabel,
} from '@/components/order/StatusBadges';
import { CancelOrderButton } from '@/components/order/CancelOrderButton';
import { PaymentPanel } from '@/components/order/PaymentPanel';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { ApiError } from '@/lib/api/client';
import { getOrder } from '@/lib/api/orders';
import type { OrderDetail } from '@/lib/api/types';
import { formatDateTime } from '@/lib/format-date';
import { formatPrice, optionLabel } from '@/lib/format';

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; order: OrderDetail }
  | { kind: 'not-found' }
  | { kind: 'error' };

function OrderSkeleton() {
  return (
    <div className="animate-pulse space-y-4" aria-busy="true">
      <div className="h-8 w-64 rounded bg-slate-100" />
      <div className="h-40 rounded-xl bg-slate-100" />
      <div className="h-40 rounded-xl bg-slate-100" />
    </div>
  );
}

function OrderBody({ order, onRefresh }: { order: OrderDetail; onRefresh: () => void }) {
  const hasDiscount = Number(order.discountAmount) > 0;
  const hasCoupon = Number(order.couponDiscount) > 0;

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <p className="text-lg font-semibold text-slate-900">Order {order.orderNumber}</p>
          <OrderStatusBadge status={order.status} />
          <PaymentStatusBadge status={order.paymentStatus} />
        </div>
        <p className="mt-1 text-sm text-slate-500">Placed on {formatDateTime(order.createdAt)}</p>
      </div>

      {order.status === 'PENDING_PAYMENT' && order.paymentInfo && order.payment ? (
        <PaymentPanel
          orderId={order.id}
          method={order.payment.method}
          amount={(Number(order.totalAmount) - Number(order.codDue)).toFixed(2)}
          expiresAt={order.expiresAt}
          paymentStatus={order.paymentStatus}
          info={order.paymentInfo}
          onSubmitted={onRefresh}
        />
      ) : null}

      {order.status === 'PENDING_PAYMENT' && order.paymentStatus !== 'PENDING' ? (
        <CancelOrderButton orderId={order.id} onDone={onRefresh} />
      ) : null}

      <div className="grid gap-8 lg:grid-cols-3 lg:items-start">
        <div className="space-y-8 lg:col-span-2">
          <section
            aria-labelledby="items-heading"
            className="rounded-xl border border-slate-200 bg-white p-5"
          >
            <h2 id="items-heading" className="text-lg font-semibold text-slate-900">
              Items
            </h2>
            <ul className="mt-2 divide-y divide-slate-100">
              {order.items.map((item) => (
                <li key={item.id} className="flex gap-4 py-4">
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                    {item.imageUrl ? (
                      <Image
                        src={item.imageUrl}
                        alt={item.name}
                        fill
                        sizes="64px"
                        className="object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-medium text-slate-900">{item.name}</p>
                    {optionLabel(item.size, item.color) ? (
                      <p className="text-xs text-slate-600">{optionLabel(item.size, item.color)}</p>
                    ) : null}
                    <p className="text-xs text-slate-500">SKU: {item.sku}</p>
                    <p className="mt-1 text-sm text-slate-600">
                      {item.quantity} x {formatPrice(item.unitPrice)}
                    </p>
                    {Number(item.discountAmount) > 0 ? (
                      <p className="text-xs font-medium text-rose-600">
                        Discount -{formatPrice(item.discountAmount)}
                      </p>
                    ) : null}
                  </div>
                  <p className="shrink-0 text-sm font-semibold text-slate-900">
                    {formatPrice(item.totalPrice)}
                  </p>
                </li>
              ))}
            </ul>
          </section>

          <section
            aria-labelledby="timeline-heading"
            className="rounded-xl border border-slate-200 bg-white p-5"
          >
            <h2 id="timeline-heading" className="text-lg font-semibold text-slate-900">
              Order timeline
            </h2>
            <ol className="mt-3 space-y-3">
              {order.timeline.map((entry, index) => (
                <li key={`${entry.toStatus}-${entry.createdAt}-${index}`} className="text-sm">
                  <p className="font-medium text-slate-900">{orderStatusLabel(entry.toStatus)}</p>
                  {entry.note ? <p className="text-slate-600">{entry.note}</p> : null}
                  <p className="text-xs text-slate-500">{formatDateTime(entry.createdAt)}</p>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <div className="space-y-6 lg:sticky lg:top-6">
          <section
            aria-labelledby="totals-heading"
            className="rounded-xl border border-slate-200 bg-white p-5"
          >
            <h2 id="totals-heading" className="text-lg font-semibold text-slate-900">
              Payment summary
            </h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-600">Subtotal</dt>
                <dd className="text-slate-900">{formatPrice(order.subtotal)}</dd>
              </div>
              {hasDiscount ? (
                <div className="flex justify-between">
                  <dt className="text-slate-600">Discount</dt>
                  <dd className="text-rose-600">-{formatPrice(order.discountAmount)}</dd>
                </div>
              ) : null}
              {hasCoupon ? (
                <div className="flex justify-between">
                  <dt className="text-slate-600">Coupon</dt>
                  <dd className="text-rose-600">-{formatPrice(order.couponDiscount)}</dd>
                </div>
              ) : null}
              <div className="flex justify-between">
                <dt className="text-slate-600">Delivery</dt>
                <dd className="text-slate-900">{formatPrice(order.deliveryCharge)}</dd>
              </div>
              <div className="flex items-baseline justify-between border-t border-slate-200 pt-3">
                <dt className="font-semibold text-slate-900">Total</dt>
                <dd className="text-base font-bold text-slate-900">
                  {formatPrice(order.totalAmount)}
                </dd>
              </div>
              {Number(order.codDue) > 0 ? (
                <>
                  <div className="flex justify-between">
                    <dt className="text-slate-600">Advance</dt>
                    <dd className="text-slate-900">
                      {formatPrice(Number(order.totalAmount) - Number(order.codDue))}
                    </dd>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <dt className="text-slate-900">Pay in cash on delivery</dt>
                    <dd className="text-slate-900">{formatPrice(order.codDue)}</dd>
                  </div>
                </>
              ) : null}
            </dl>
            {order.payment ? (
              <p className="mt-3 text-xs text-slate-500">
                Payment method: {paymentMethodLabel(order.payment.method)}
                {order.approvedTransactionId ? (
                  <span className="mt-1 block">
                    Transaction ID:{' '}
                    <span className="font-mono text-slate-700">{order.approvedTransactionId}</span>
                  </span>
                ) : null}
              </p>
            ) : null}
          </section>

          <section
            aria-labelledby="shipping-heading"
            className="rounded-xl border border-slate-200 bg-white p-5"
          >
            <h2 id="shipping-heading" className="text-lg font-semibold text-slate-900">
              Shipping
            </h2>
            <address className="mt-3 space-y-0.5 text-sm not-italic text-slate-700">
              <p className="font-medium text-slate-900">{order.shipping.name}</p>
              <p>{order.shipping.phone}</p>
              <p>{order.shipping.email}</p>
              <p>{order.shipping.address}</p>
              <p>
                {order.shipping.area}, {order.shipping.city} {order.shipping.postalCode}
              </p>
            </address>
            {order.notes ? (
              <p className="mt-3 text-sm text-slate-600">Notes: {order.notes}</p>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}

export function OrderDetailContent({ orderId }: { orderId: string }) {
  const router = useRouter();
  const { status: authStatus } = useAuth();
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const mountedRef = useRef(true);
  const orderIdRef = useRef(orderId);

  useEffect(() => {
    mountedRef.current = true;
    orderIdRef.current = orderId;
    return () => {
      mountedRef.current = false;
    };
  }, [orderId]);

  /** Re-fetches without the loading skeleton. A failed refresh keeps the current view. */
  const refresh = useCallback(() => {
    const requestedId = orderId;
    getOrder(requestedId)
      .then((order) => {
        if (mountedRef.current && orderIdRef.current === requestedId) {
          setState({ kind: 'ready', order });
        }
      })
      .catch(() => {
        // Keep showing the last loaded order.
      });
  }, [orderId]);

  // Signed-out visitors go to login and come straight back to this order afterwards.
  useEffect(() => {
    if (authStatus === 'unauthenticated') {
      router.replace(`/login?next=${encodeURIComponent(`/account/orders/${orderId}`)}`);
    }
  }, [authStatus, orderId, router]);

  useEffect(() => {
    if (authStatus !== 'authenticated') return;
    let cancelled = false;
    setState({ kind: 'loading' });
    getOrder(orderId)
      .then((order) => {
        if (!cancelled) setState({ kind: 'ready', order });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setState(
          err instanceof ApiError && err.status === 404 ? { kind: 'not-found' } : { kind: 'error' },
        );
      });
    return () => {
      cancelled = true;
    };
  }, [authStatus, orderId, attempt]);

  if (authStatus !== 'authenticated' || state.kind === 'loading') {
    return <OrderSkeleton />;
  }

  if (state.kind === 'not-found') {
    return (
      <div className="space-y-4">
        <EmptyState
          title="Order not found"
          message="We could not find this order in your account."
        />
        <div className="text-center">
          <Link
            href="/products"
            className="inline-block rounded-lg bg-brand-600 px-5 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Continue shopping
          </Link>
        </div>
      </div>
    );
  }

  if (state.kind === 'error') {
    return (
      <div className="space-y-4">
        <ErrorState
          title="Could not load this order"
          message="Please check your connection and try again."
        />
        <div className="text-center">
          <button
            type="button"
            onClick={() => setAttempt((count) => count + 1)}
            className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return <OrderBody order={state.order} onRefresh={refresh} />;
}
