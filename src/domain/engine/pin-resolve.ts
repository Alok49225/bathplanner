/**
 * Pin-and-resolve — lock one category's product, re-optimize the rest
 * within the remaining budget. Extends selectWithinBudget (t8) rather than
 * reimplementing it, and builds the result with buildBundle (t10) so a
 * pinned bundle is constructed identically to any other.
 */

import type { Product, ProductCategory, Theme } from "../types/product";
import type { Room } from "../types/room";
import type { Bundle, BundleTier } from "../types/bundle";
import { filterEligibleProducts } from "./compatibility-rules";
import type { CompatibilityIssue } from "./compatibility-rules";
import { selectWithinBudget } from "./budget-selector";
import { buildBundle, resolvePlumbingPoints } from "./tier-generator";

export type PinResolveResult =
  | { feasible: true; bundle: Bundle }
  | { feasible: false; reason: "invalid-pin" }
  | { feasible: false; reason: "no-eligible-options"; issues: CompatibilityIssue[] }
  | { feasible: false; reason: "missing-plumbing-point" }
  | { feasible: false; reason: "over-budget"; cheapestPossibleCents: number };

export function pinAndResolve(
  catalog: Product[],
  room: Room,
  budgetCents: number,
  targetTheme: Theme,
  tier: BundleTier,
  pinnedCategory: ProductCategory,
  pinnedProductId: string
): PinResolveResult {
  const pinnedProduct = catalog.find((p) => p.id === pinnedProductId && p.category === pinnedCategory);
  if (!pinnedProduct) {
    return { feasible: false, reason: "invalid-pin" };
  }

  // Checked before filterEligibleProducts deliberately — see the identical
  // comment in tier-generator.ts's generateTiers: canFit needs a plumbing
  // point to test against, so a missing one surfaces there first as a
  // misleading "no products fit" instead of the real, more fixable cause.
  const plumbingPointByCategory = resolvePlumbingPoints(room);
  if (!plumbingPointByCategory) return { feasible: false, reason: "missing-plumbing-point" };

  const { eligible, errors } = filterEligibleProducts(catalog, room);
  // a category other than the pinned one has no eligible options at all —
  // pinning can't fix that.
  const blockingErrors = errors.filter((e) => !e.categories.includes(pinnedCategory));
  if (blockingErrors.length > 0) {
    return { feasible: false, reason: "no-eligible-options", issues: blockingErrors };
  }

  const selection = selectWithinBudget(eligible, budgetCents, { [pinnedCategory]: pinnedProduct });
  if (!selection.feasible) {
    // blockingErrors above already guarantees every non-pinned category has
    // eligible options, so this can only fail over-budget.
    if (selection.reason !== "over-budget") {
      throw new Error("unreachable: blockingErrors already guaranteed every non-pinned category has options");
    }
    return { feasible: false, reason: "over-budget", cheapestPossibleCents: selection.cheapestPossibleCents };
  }

  const bundle = buildBundle(
    tier,
    selection.items,
    selection.totalPriceCents,
    budgetCents,
    room,
    targetTheme,
    plumbingPointByCategory,
    eligible
  );

  return { feasible: true, bundle };
}
