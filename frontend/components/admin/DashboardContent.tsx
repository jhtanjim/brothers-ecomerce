'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { SalesChart } from '@/components/admin/SalesChart';
import { TopProducts } from '@/components/admin/TopProducts';
import { OrderStatusBadge, PaymentStatusBadge } from '@/components/order/StatusBadges';
import { ErrorState } from '@/components/ui/ErrorState';
import { getDashboardOverview } from '@/lib/api/admin-dashboard';
import type { DashboardOverview } from '@/lib/api/types';
import { formatPrice, optionLabel } from '@/lib/format';
import { formatDateTime } from '@/lib/format-date';

type LoadState =
  { kind: 'loading' } | { kind: 'ready'; data: DashboardOverview } | { kind: 'error' };

interface CardProps {
  label: string;
  value: string;
  href?: string;
  highlight?: boolean;
}

function Card({ label, value, href, highlight = false }: CardProps) {
  const body = (
    <div
      className={`h-full rounded-xl border bg-white p-4 ${
        highlight ? 'border-amber-300' : 'border-slate-200'
      } ${href ? 'hover:border-brand-300' : ''}`}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
    </div>
  );
  return href ? (
    <Link href={href} className="block">
      {body}
    </Link>
  ) : (
    body
  );
}

function Section({
  title,
  href,
  linkLabel,
  children,
}: {
  title: string;
  href?: string;
  linkLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        {href && linkLabel ? (
          <Link href={href} className="text-sm font-medium text-brand-600 hover:text-brand-700">
            {linkLabel}
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="px-4 py-6 text-center text-sm text-slate-500">{text}</p>;
}

function DashboardSkeleton() {
  return (
    <div className="animate-pulse space-y-6" aria-busy="true">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="h-24 rounded-xl bg-slate-200" />
        ))}
      </div>
      <div className="h-48 rounded-xl bg-slate-200" />
    </div>
  );
}

export function DashboardContent() {
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ kind: 'loading' });
    getDashboardOverview()
      .then((data) => {
        if (!cancelled) setState({ kind: 'ready', data });
      })
      .catch(() => {
        if (!cancelled) setState({ kind: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  if (state.kind === 'loading') return <DashboardSkeleton />;

  if (state.kind === 'error') {
    return (
      <div className="space-y-4">
        <ErrorState
          title="Could not load the dashboard"
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

  const { cards, recentOrders, pendingPayments, lowStock } = state.data;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card label="Total sales" value={formatPrice(cards.totalSales)} />
        <Card label="Today's sales" value={formatPrice(cards.todaySales)} />
        <Card label="Total orders" value={String(cards.totalOrders)} href="/admin/orders" />
        <Card
          label="Pending orders"
          value={String(cards.pendingOrders)}
          href="/admin/orders?status=PENDING_PAYMENT"
        />
        <Card
          label="Pending payments"
          value={String(cards.pendingPayments)}
          href="/admin/payments"
          highlight={cards.pendingPayments > 0}
        />
        <Card label="Total customers" value={String(cards.totalCustomers)} />
        <Card label="Total products" value={String(cards.totalProducts)} />
        <Card
          label="Low stock items"
          value={String(cards.lowStockProducts)}
          highlight={cards.lowStockProducts > 0}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SalesChart />
        </div>
        <TopProducts />
      </div>

      <Section title="Recent orders" href="/admin/orders" linkLabel="View all">
        {recentOrders.length === 0 ? (
          <Empty text="No orders have been placed yet." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-left text-sm">
              <tbody className="divide-y divide-slate-100">
                {recentOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50">
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">
                      {order.orderNumber}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{order.customerName}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                      {formatDateTime(order.createdAt)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-slate-900">
                      {formatPrice(order.totalAmount)}
                    </td>
                    <td className="px-4 py-3">
                      <OrderStatusBadge status={order.status} />
                    </td>
                    <td className="px-4 py-3">
                      <PaymentStatusBadge status={order.paymentStatus} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <Link
                        href={`/admin/orders/${encodeURIComponent(order.id)}`}
                        className="font-medium text-brand-600 hover:text-brand-700"
                      >
                        Manage
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Pending payments" href="/admin/payments" linkLabel="Open queue">
          {pendingPayments.length === 0 ? (
            <Empty text="No payments are waiting for review." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {pendingPayments.map((payment) => (
                <li
                  key={payment.orderId}
                  className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900">{payment.orderNumber}</p>
                    <p className="truncate text-xs text-slate-500">
                      {payment.customerName}
                      {payment.method
                        ? ` · ${payment.method === 'BKASH' ? 'bKash' : 'Nagad'}`
                        : ''}{' '}
                      · {formatDateTime(payment.createdAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-4">
                    <span className="font-semibold text-slate-900">
                      {formatPrice(payment.totalAmount)}
                    </span>
                    <Link
                      href="/admin/payments"
                      className="font-medium text-brand-600 hover:text-brand-700"
                    >
                      Review
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Low stock" href="/admin/low-stock" linkLabel="View all">
          {lowStock.length === 0 ? (
            <Empty text="No products are running low." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {lowStock.map((product) => (
                <li
                  key={product.sku}
                  className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-900">{product.name}</p>
                    {optionLabel(product.size, product.color) ? (
                      <p className="text-xs text-slate-600">
                        {optionLabel(product.size, product.color)}
                      </p>
                    ) : null}
                    <p className="text-xs text-slate-500">{product.sku}</p>
                  </div>
                  <p
                    className={`shrink-0 font-semibold ${product.stockQuantity === 0 ? 'text-rose-600' : 'text-amber-700'}`}
                  >
                    {product.stockQuantity} left
                    <span className="ml-1 text-xs font-normal text-slate-500">
                      (alert at {product.lowStockThreshold})
                    </span>
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </div>
  );
}
