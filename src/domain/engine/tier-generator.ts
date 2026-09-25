/**
 * Tier generator — the orchestrator that finally produces real Bundle (t5)
 * objects by composing filterEligibleProducts (t4), selectWithinBudget (t8)
 * run at three spend caps, scoreBundle (t9), and validateFit (t7).
 *
 * `buildBundle` and `resolvePlumbingPoints` are exported so pin-resolve.ts
 * (t12) can produce a Bundle the identical way instead of duplicating this
 * construction logic for a single re-solved tier.
 */

import type { Product, ProductCategory, Theme } from "../types/product";
import { PRODUCT_CATEGORIES } from "../types/product";
import type { Room, PlumbingPoint } from "../types/room";
import type { Bundle, BundleLineItem, BundleTier } from "../types/bundle";
import { filterEligibleProducts, checkFinishCoordination } from "./compatibility-rules";
import type { CompatibilityIssue } from "./compatibility-rules";
import { selectWithinBudget } from "./budget-selector";
import { scoreBundle } from "./bundle-scorer";
import { validateFit } from "./fit-validator";
import type { FloorFixturePlacement, FloorFixtureCategory } from "./fit-validator";
import { generateRationale } from "./rationale-generator";

export type TierGenerationResult =
  | { feasible: true; tiers: [Bundle, Bundle, Bundle] }
  | { feasible: false; reason: "no-eligible-options"; issues: CompatibilityIssue[] }
  | { feasible: false; reason: "missing-plumbing-point" }
  | { feasible: false; reason: "over-budget"; cheapestPossibleCents: number };

const TIER_FRACTIONS: Record<BundleTier, number> = {
  value: 0.65,
  balanced: 0.85,
  premium: 1.0,
};

export const FLOOR_CATEGORIES: FloorFixtureCategory[] = ["toilet", "vanity", "shower"];

/**
 * Resolves each floor-fixture category's plumbing point once; null if a
 * category the room actually needs (i.e. not in `omittedCategories`) is
 * missing its point entirely. An omitted category is deliberately left
 * absent from the returned record rather than erroring — that's the whole
 * point of the placement solver's fallback ladder being allowed to drop one.
 */
export function resolvePlumbingPoints(
  room: Room,
  omittedCategories: FloorFixtureCategory[] = []
): Partial<Record<FloorFixtureCategory, PlumbingPoint>> | null {
  const byCategory: Partial<Record<FloorFixtureCategory, PlumbingPoint>> = {};
  for (const category of FLOOR_CATEGORIES) {
    if (omittedCategories.includes(category)) continue;
    const point = room.plumbing.find((p) => p.category === category);
    if (!point) return null;
    byCategory[category] = point;
  }
  return byCategory;
}

export function buildBundle(
  tier: BundleTier,
  selectionItems: Partial<Record<ProductCategory, Product>>,
  totalPriceCents: number,
  budgetCents: number,
  room: Room,
  targetTheme: Theme,
  plumbingPointByCategory: Partial<Record<FloorFixtureCategory, PlumbingPoint>>,
  eligible: Record<ProductCategory, Product[]>
): Bundle {
  const score = scoreBundle(selectionItems, targetTheme);

  // Faucet and lighting have no independent plumbing point of their own —
  // they inherit the vanity's. No vanity point means nothing to inherit, so
  // they cascade out of the bundle along with it, not just floor categories.
  const vanityPresent = plumbingPointByCategory.vanity !== undefined;

  const placements: FloorFixturePlacement[] = FLOOR_CATEGORIES.filter(
    (category) => plumbingPointByCategory[category] !== undefined && selectionItems[category] !== undefined
  ).map((category) => ({
    category,
    product: selectionItems[category]!,
    plumbingPointId: plumbingPointByCategory[category]!.id,
  }));
  const fitIssues = validateFit(placements, room);

  const presentProducts = PRODUCT_CATEGORIES.map((c) => selectionItems[c]).filter(
    (p): p is Product => p !== undefined
  );
  const compatIssues = checkFinishCoordination(presentProducts);

  const warnings = [
    ...fitIssues.map((i) => (i.severity === "error" ? `[fit error] ${i.message}` : i.message)),
    ...compatIssues.map((i) => i.message),
  ];

  const items: Partial<Record<ProductCategory, BundleLineItem>> = {};
  for (const category of PRODUCT_CATEGORIES) {
    const isFloor = FLOOR_CATEGORIES.includes(category as FloorFixtureCategory);
    if (isFloor) {
      if (plumbingPointByCategory[category as FloorFixtureCategory] === undefined) continue; // this floor category was omitted
    } else if (!vanityPresent) {
      continue; // cascade: faucet/lighting have nothing to mount to without a vanity
    }
    const product = selectionItems[category];
    if (!product) continue; // defensive — should already be guaranteed by the checks above

    const position = isFloor
      ? plumbingPointByCategory[category as FloorFixtureCategory]!.position
      : plumbingPointByCategory.vanity!.position;

    items[category] = {
      category,
      productId: product.id,
      placement: { position },
      rationale: generateRationale(product, category, targetTheme, eligible[category]),
    };
  }

  return {
    id: `bundle-${tier}`,
    tier,
    items,
    totalPriceCents,
    budgetCents,
    warnings,
    sustainabilityScore: score.waterEfficiency,
  };
}

/**
 * Widens a floor-category omission list to the full set of product
 * categories that need to sit out of eligibility/selection — vanity being
 * omitted also cascades to faucet and lighting, which have no independent
 * plumbing point of their own to inherit from otherwise.
 */
function cascadeOmissions(floorOmissions: FloorFixtureCategory[]): ProductCategory[] {
  const cascaded: ProductCategory[] = [...floorOmissions];
  if (floorOmissions.includes("vanity")) cascaded.push("faucet", "lighting");
  return cascaded;
}

export function generateTiers(
  catalog: Product[],
  room: Room,
  budgetCents: number,
  targetTheme: Theme,
  omittedCategories: FloorFixtureCategory[] = []
): TierGenerationResult {
  // Checked before filterEligibleProducts deliberately: canFit (called inside
  // it) needs a plumbing point to test a footprint against, so a floor
  // category missing one fails eligibility too — but "no plumbing point
  // marked yet" (the common case mid-intake-form) and "no product fits"
  // are different problems with different fixes, and only checking
  // plumbing points first surfaces the right one instead of the engine's
  // fit-driven message papering over the real cause. A category in
  // `omittedCategories` is neither of those — it's the placement solver's
  // own fallback ladder having deliberately decided not to place it, so it's
  // left out of this check entirely rather than tripping either failure.
  const plumbingPointByCategory = resolvePlumbingPoints(room, omittedCategories);
  if (!plumbingPointByCategory) return { feasible: false, reason: "missing-plumbing-point" };

  const cascadedOmissions = cascadeOmissions(omittedCategories);
  const { eligible, errors } = filterEligibleProducts(catalog, room, cascadedOmissions);
  if (errors.length > 0) {
    return { feasible: false, reason: "no-eligible-options", issues: errors };
  }

  const premiumSelection = selectWithinBudget(eligible, budgetCents, {}, cascadedOmissions);
  if (!premiumSelection.feasible) {
    // errors.length === 0 above already guarantees every category has at
    // least one eligible option, so the only way selectWithinBudget can
    // fail here is over-budget — never "no-eligible-options" again.
    if (premiumSelection.reason !== "over-budget") {
      throw new Error("unreachable: filterEligibleProducts already guaranteed every category has options");
    }
    return { feasible: false, reason: "over-budget", cheapestPossibleCents: premiumSelection.cheapestPossibleCents };
  }

  const tiers = (["value", "balanced", "premium"] as BundleTier[]).map((tier) => {
    const { items: selectionItems, totalPriceCents } =
      tier === "premium"
        ? { items: premiumSelection.items, totalPriceCents: premiumSelection.totalPriceCents }
        : resolveTierSelection(eligible, budgetCents, TIER_FRACTIONS[tier], cascadedOmissions);

    return buildBundle(
      tier,
      selectionItems,
      totalPriceCents,
      budgetCents,
      room,
      targetTheme,
      plumbingPointByCategory,
      eligible
    );
  }) as [Bundle, Bundle, Bundle];

  return { feasible: true, tiers };
}

/** Runs the capped selection for Value/Balanced; falls back to the cheapest baseline if the cap itself is unaffordable. */
function resolveTierSelection(
  eligible: Record<ProductCategory, Product[]>,
  budgetCents: number,
  fraction: number,
  omittedCategories: ProductCategory[] = []
): { items: Partial<Record<ProductCategory, Product>>; totalPriceCents: number } {
  const cap = Math.round(budgetCents * fraction);
  const result = selectWithinBudget(eligible, cap, {}, omittedCategories);
  if (result.feasible) return result;

  // Every non-omitted category is already known to have eligible options by
  // the time a caller reaches this fallback (generateTiers checked that
  // before ever calling resolveTierSelection), so a fractional cap can only
  // fail over-budget.
  if (result.reason !== "over-budget") {
    throw new Error("unreachable: caller already guaranteed every active category has eligible options");
  }
  const fallback = selectWithinBudget(eligible, result.cheapestPossibleCents, {}, omittedCategories);
  if (!fallback.feasible) {
    throw new Error("unreachable: cheapestPossibleCents must itself be feasible");
  }
  return fallback;
}
