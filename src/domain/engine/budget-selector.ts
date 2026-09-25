/**
 * Budget-constrained selector — "spend the budget as well as possible, one
 * upgrade at a time." Starts from the cheapest valid combination, then
 * repeatedly applies whichever single category swap increases total spend
 * the most without exceeding budget, until no affordable upgrade remains.
 */

import type { Product, ProductCategory } from "../types/product";
import { PRODUCT_CATEGORIES } from "../types/product";

export type SelectionResult =
  | { feasible: true; items: Partial<Record<ProductCategory, Product>>; totalPriceCents: number }
  | { feasible: false; reason: "no-eligible-options"; category: ProductCategory }
  | { feasible: false; reason: "over-budget"; cheapestPossibleCents: number };

function cheapest(products: Product[]): Product {
  return products.reduce((min, p) => (p.priceCents < min.priceCents ? p : min));
}

/** Safe to assert non-null: callers only ever pass the same `categories` list
 * that was just used to populate every one of `items`'s keys. */
function sumPrices(items: Partial<Record<ProductCategory, Product>>, categories: ProductCategory[]): number {
  return categories.reduce((sum, category) => sum + items[category]!.priceCents, 0);
}

export function selectWithinBudget(
  eligibleByCategory: Record<ProductCategory, Product[]>,
  budgetCents: number,
  pinned: Partial<Record<ProductCategory, Product>> = {},
  omittedCategories: ProductCategory[] = []
): SelectionResult {
  const activeCategories = PRODUCT_CATEGORIES.filter((category) => !omittedCategories.includes(category));

  for (const category of activeCategories) {
    if (!pinned[category] && !eligibleByCategory[category]?.length) {
      return { feasible: false, reason: "no-eligible-options", category };
    }
  }

  const items = {} as Partial<Record<ProductCategory, Product>>;
  for (const category of activeCategories) {
    items[category] = pinned[category] ?? cheapest(eligibleByCategory[category]);
  }
  let total = sumPrices(items, activeCategories);

  if (total > budgetCents) {
    return { feasible: false, reason: "over-budget", cheapestPossibleCents: total };
  }

  let upgraded = true;
  while (upgraded) {
    upgraded = false;
    let bestCategory: ProductCategory | null = null;
    let bestProduct: Product | null = null;
    let bestGain = 0;

    for (const category of activeCategories) {
      if (pinned[category]) continue; // a pinned category is never swapped

      const currentPrice = items[category]!.priceCents;
      for (const candidate of eligibleByCategory[category]) {
        if (candidate.id === items[category]!.id) continue;
        const candidateTotal = total - currentPrice + candidate.priceCents;
        const gain = candidate.priceCents - currentPrice;
        if (candidateTotal <= budgetCents && gain > bestGain) {
          bestGain = gain;
          bestCategory = category;
          bestProduct = candidate;
        }
      }
    }

    if (bestCategory && bestProduct) {
      total = total - items[bestCategory]!.priceCents + bestProduct.priceCents;
      items[bestCategory] = bestProduct;
      upgraded = true;
    }
  }

  return { feasible: true, items, totalPriceCents: total };
}
