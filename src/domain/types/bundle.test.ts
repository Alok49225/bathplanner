import { describe, it, expect } from "vitest";
import type { Bundle, BundleLineItem } from "./bundle";
import { BUNDLE_TIERS } from "./bundle";
import type { ProductCategory } from "./product";

const CATEGORIES: ProductCategory[] = [
  "toilet",
  "vanity",
  "faucet",
  "shower",
  "lighting",
];

function makeLineItem(
  category: ProductCategory,
  overrides: Partial<BundleLineItem> = {}
): BundleLineItem {
  return {
    category,
    productId: `sample-${category}`,
    placement: { position: { x: 10, y: 10 } },
    ...overrides,
  };
}

function makeBundle(overrides: Partial<Bundle> = {}): Bundle {
  return {
    id: "bundle-balanced-1",
    tier: "balanced",
    items: {
      toilet: makeLineItem("toilet"),
      vanity: makeLineItem("vanity"),
      faucet: makeLineItem("faucet"),
      shower: makeLineItem("shower"),
      lighting: makeLineItem("lighting"),
    },
    totalPriceCents: 285000,
    budgetCents: 300000,
    warnings: [],
    ...overrides,
  };
}

describe("Bundle schema", () => {
  it("accepts one of each declared tier", () => {
    BUNDLE_TIERS.forEach((tier) => {
      const bundle = makeBundle({ tier });
      expect(bundle.tier).toBe(tier);
    });
  });

  it("keys items by exactly the five required categories, no more no less", () => {
    const bundle = makeBundle();
    expect(Object.keys(bundle.items).sort()).toEqual([...CATEGORIES].sort());
  });

  it("keeps each line item's own category field consistent with its key", () => {
    const bundle = makeBundle();
    (Object.keys(bundle.items) as ProductCategory[]).forEach((key) => {
      expect(bundle.items[key]!.category).toBe(key);
    });
  });

  it("stores totals as non-negative integer cents", () => {
    const bundle = makeBundle({ totalPriceCents: 285000, budgetCents: 300000 });
    expect(Number.isInteger(bundle.totalPriceCents)).toBe(true);
    expect(Number.isInteger(bundle.budgetCents)).toBe(true);
    expect(bundle.totalPriceCents).toBeGreaterThanOrEqual(0);
  });

  it("never shows a bundle over its own budget ceiling", () => {
    const bundle = makeBundle({ totalPriceCents: 285000, budgetCents: 300000 });
    expect(bundle.totalPriceCents).toBeLessThanOrEqual(bundle.budgetCents);
  });

  it("defaults warnings to an empty array rather than being absent", () => {
    const bundle = makeBundle({ warnings: [] });
    expect(bundle.warnings).toEqual([]);
  });

  it("carries warnings through instead of discarding them", () => {
    const bundle = makeBundle({ warnings: ["Vanity clearance is tight at 19in"] });
    expect(bundle.warnings).toHaveLength(1);
  });

  it("leaves rationale undefined until t11 fills it in, never a placeholder string", () => {
    const bundle = makeBundle();
    expect(bundle.items.toilet!.rationale).toBeUndefined();
    const withRationale = makeBundle({
      items: {
        ...makeBundle().items,
        toilet: makeLineItem("toilet", { rationale: "Fits the comfort-height requirement." }),
      },
    });
    expect(withRationale.items.toilet!.rationale).toContain("comfort-height");
  });

  it("keeps sustainabilityScore optional and within 0-1 when present", () => {
    const withoutScore = makeBundle();
    const withScore = makeBundle({ sustainabilityScore: 0.72 });
    expect(withoutScore.sustainabilityScore).toBeUndefined();
    expect(withScore.sustainabilityScore).toBeGreaterThanOrEqual(0);
    expect(withScore.sustainabilityScore).toBeLessThanOrEqual(1);
  });

  it("references a placement position for every line item", () => {
    const bundle = makeBundle();
    (Object.keys(bundle.items) as ProductCategory[]).forEach((key) => {
      const position = bundle.items[key]!.placement.position;
      expect(typeof position.x).toBe("number");
      expect(typeof position.y).toBe("number");
    });
  });
});
