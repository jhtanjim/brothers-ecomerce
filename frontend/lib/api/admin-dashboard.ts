import { apiFetch } from './client';
import type {
  DailyReport,
  DashboardLowStockItem,
  DashboardOverview,
  DashboardSales,
  DashboardTopProduct,
  MonthlyReport,
} from './types';

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

export function getMonthlyReport(month: string): Promise<MonthlyReport> {
  return apiFetch<MonthlyReport>(`/admin/dashboard/monthly?month=${encodeURIComponent(month)}`);
}

export function getLowStock(): Promise<DashboardLowStockItem[]> {
  return apiFetch<DashboardLowStockItem[]>('/admin/dashboard/low-stock');
}
