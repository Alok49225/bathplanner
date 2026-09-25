/**
 * Compatibility rule set — category coverage + hard constraint filtering,
 * and finish coordination. First module in the Solver Engine (t7-t13 land
 * alongside it). Standalone: nothing calls this yet.
 */

import type { Product, ProductCategory, Finish, InstallComplexity } from "../types/product";
import { PRODUCT_CATEGORIES } from "../types/product";
import type { Room } from "../types/room";
import { canFit } from "./fit-validator";
import type { FloorFixtureCategory } from "./fit-validator";

const FLOOR_FIXTURE_CATEGORIES: FloorFixtureCategory[] = ["toilet", "vanity", "shower"];

export interface CompatibilityIssue {
  severity: "error" | "warning";
  code: "install-complexity-exceeded" | "finish-mismatch" | "category-unavailable";
  message: string;
  categories: ProductCategory[];
}

const INSTALL_COMPLEXITY_RANK: Record<InstallComplexity, number> = {
  "drop-in": 0,
  standard: 1,
  specialist: 2,
};

/**
 * Filters the catalog per category against the constraints that are actually
 * catalog-level filters. "keep-fixture" and "must-include-tag" aren't —
 * keep-fixture means "don't re-select this category at all" (a solver/t12
 * concern) and must-include-tag is a bundle-level existence check ("does the
 * finished bundle contain a soaking tub anywhere"), not a per-product filter.
 * Only "avoid-tag" and "max-install-complexity" narrow what's eligible here.
 *
 * Also pre-filters toilet/vanity/shower by physical fit (t7's `canFit`) —
 * without this, the budget selector (t8) has no idea a product physically
 * can't go in the room and could pick it anyway, only for validateFit to
 * flag it after the fact. The blueprint's own guarantee ("never shown if it
 * violates physical fit") has to be enforced before selection, not just
 * checked after.
 */
export function filterEligibleProducts(
  catalog: Product[],
  room: Room,
  omittedCategories: ProductCategory[] = []
): { eligible: Record<ProductCategory, Product[]>; errors: CompatibilityIssue[] } {
  const isOmitted = (category: ProductCategory) => omittedCategories.includes(category);
  const constraints = room.constraints;
  const avoidTags = constraints
    .filter((c) => c.rule.type === "avoid-tag")
    .map((c) => (c.rule as { type: "avoid-tag"; tag: string }).tag);

  const complexityLimits = constraints
    .filter((c) => c.rule.type === "max-install-complexity")
    .map((c) => (c.rule as { type: "max-install-complexity"; level: InstallComplexity }).level);
  const maxComplexityRank = complexityLimits.length
    ? Math.min(...complexityLimits.map((l) => INSTALL_COMPLEXITY_RANK[l]))
    : INSTALL_COMPLEXITY_RANK.specialist;

  const eligible = {} as Record<ProductCategory, Product[]>;
  for (const category of PRODUCT_CATEGORIES) {
    if (isOmitted(category)) {
      eligible[category] = [];
      continue;
    }
    const isFloorFixture = FLOOR_FIXTURE_CATEGORIES.includes(category as FloorFixtureCategory);
    eligible[category] = catalog.filter(
      (p) =>
        p.category === category &&
        !avoidTags.some((tag) => p.styleTags.includes(tag)) &&
        INSTALL_COMPLEXITY_RANK[p.installComplexity] <= maxComplexityRank &&
        (!isFloorFixture || canFit(p, room, category as FloorFixtureCategory))
    );
  }

  const errors: CompatibilityIssue[] = [];
  for (const category of PRODUCT_CATEGORIES) {
    if (isOmitted(category)) continue;
    if (eligible[category].length === 0) {
      errors.push({
        severity: "error",
        code: "category-unavailable",
        message: `No ${category} products remain after applying the room's constraints.`,
        categories: [category],
      });
    }
  }

  return { eligible, errors };
}

const NEUTRAL_FINISHES: Finish[] = ["matte-black", "white"];

/**
 * "Two metals" rule: neutral finishes (matte-black, white) always coordinate;
 * among the rest, more than 2 distinct finishes is a warning, not a hard
 * rejection — a bundle is still shown, just flagged.
 */
/** Distinct non-neutral finishes in a set of items — matte-black/white don't count. Shared with the bundle scorer (t9) so both agree on what "coordinated" means. */
export function nonNeutralFinishes(items: Product[]): Finish[] {
  return [...new Set(items.map((p) => p.finish).filter((f) => !NEUTRAL_FINISHES.includes(f)))];
}

export function checkFinishCoordination(items: Product[]): CompatibilityIssue[] {
  const nonNeutral = nonNeutralFinishes(items);

  if (nonNeutral.length <= 2) return [];

  const categories = items
    .filter((p) => nonNeutral.includes(p.finish))
    .map((p) => p.category);

  return [
    {
      severity: "warning",
      code: "finish-mismatch",
      message: `This bundle mixes ${nonNeutral.length} finishes (${nonNeutral.join(", ")}) — most bathrooms use no more than 2 for a coordinated look.`,
      categories,
    },
  ];
}
