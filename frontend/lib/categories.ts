import type { CategorySummary } from '@/lib/api/types';

export function topLevelCategories(categories: CategorySummary[]): CategorySummary[] {
  return categories.filter((category) => category.parentId === null);
}

export function subcategoriesOf(
  categories: CategorySummary[],
  parentId: string,
): CategorySummary[] {
  return categories.filter((category) => category.parentId === parentId);
}

/** Each parent followed by its subcategories, for flat lists such as a select. */
export function categoriesInTreeOrder<T extends { id: string; parentId: string | null }>(
  categories: T[],
): T[] {
  const known = new Set(categories.map((category) => category.id));
  return categories
    .filter((category) => category.parentId === null || !known.has(category.parentId))
    .flatMap((parent) => [
      parent,
      ...categories.filter((category) => category.parentId === parent.id),
    ]);
}

/** A main category's page also lists its subcategories' products, so its count includes them. */
export function categoryProductCount(
  categories: CategorySummary[],
  category: CategorySummary,
): number {
  return subcategoriesOf(categories, category.id).reduce(
    (sum, child) => sum + child.productCount,
    category.productCount,
  );
}
