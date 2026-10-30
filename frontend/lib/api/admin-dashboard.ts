import { apiFetch } from './client';
import type { DailyReport, DashboardOverview, DashboardSales, DashboardTopProduct } from './types';

export function getDashboardOverview(): Promise<DashboardOverview> {
  return apiFetch<DashboardOverview>('/admin/dashboard');
}

export function getDashboardSales(days: number): Promise<DashboardSales> {
  return apiFetch<DashboardSales>(`/admin/dashboard/sales?days=${days}`);
}

export function getDashboardTopProducts(limit: number): Promise<DashboardTopProduct[]> {
  return apiFetch<DashboardTopProduct[]>(`/admin/dashboard/top-products?limit=${limit}`);
}

export function getDailyReport(date: string): Promise<DailyReport> {
  return apiFetch<DailyReport>(`/admin/dashboard/daily?date=${encodeURIComponent(date)}`);
}
