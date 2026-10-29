import { apiFetchPage } from './client';
import type { CategorySummary } from './types';

const CATALOG_REVALIDATE_SECONDS = 60;
const MAX_CATEGORIES = 100;

/** Active categories, ordered by the backend (sortOrder). */
export async function getCategories(): Promise<CategorySummary[]> {
  const { items } = await apiFetchPage<CategorySummary>(`/categories?limit=${MAX_CATEGORIES}`, {
    next: { revalidate: CATALOG_REVALIDATE_SECONDS },
  });
  return items;
}