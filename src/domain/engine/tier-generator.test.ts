import { describe, it, expect } from "vitest";
import { generateTiers } from "./tier-generator";
import type { Product, ProductCategory } from "../types/product";
import type { Room } from "../types/room";

function makeProduct(id: string, category: ProductCategory, priceCents: number, overrides: Partial<Product> = {}): Product {
  return {
    id,
    category,
    name: id,
    brand: "Kohler",
    priceCents,
    finish: "white",
    dimensions:
      category === "toilet"
        ? { width: 16, depth: 28, height: 30 }
        : category === "vanity"
          ? { width: 30, depth: 21, height: 34 }
          : category === "shower"
            ? { width: 36, depth: 36, height: 48 }
            : { width: 4, depth: 4, height: 8 },
    installComplexity: "standard",
    styleTags: [],
    themeScores: { "minimalist-modern": 0.5, "classic-luxury": 0.5, "japanese-zen": 0.5 },
    finishFamily: "test",
    ...overrides,
  };
}

// Same deliberately distinct gaps as budget-selector.test.ts, so the greedy
// order is unambiguous: shower 70000 > vanity 60000 > toilet 15000 > lighting 13000 > faucet 12000
const CATALOG: Product[] = [
  makeProduct("toilet-cheap", "toilet", 30000),
  makeProduct("toilet-exp", "toilet", 45000),
  makeProduct("vanity-cheap", "vanity", 80000),
  makeProduct("vanity-exp", "vanity", 140000),
  makeProduct("faucet-cheap", "faucet", 20000),
  makeProduct("faucet-exp", "faucet", 32000),
  makeProduct("shower-cheap", "shower", 100000),
  makeProduct("shower-exp", "shower", 170000),
  makeProduct("lighting-cheap", "lighting", 15000),
  makeProduct("lighting-exp", "lighting", 28000),
];
const BASELINE = 245000;

// A generous, well-separated room so no unintended clearance warnings show up.
const ROOM: Room = {
  widthIn: 200,
  lengthIn: 200,
  ceilingHeightIn: 96,
  doors: [],
  windows: [],
  plumbing: [
    { id: "toilet-point", category: "toilet", position: { x: 20, y: 190 }, wall: "south" },
    { id: "vanity-point", category: "vanity", position: { x: 100, y: 190 }, wall: "south" },
    { id: "shower-point", category: "shower", position: { x: 20, y: 20 }, wall: "north" },
  ],
  accessibility: {},
  constraints: [],
};

describe("generateTiers", () => {
  it("produces three tiers with non-decreasing price: value <= balanced <= premium", () => {
    const result = generateTiers(CATALOG, ROOM, 400000, "minimalist-modern");
    expect(result.feasible).toBe(true);
    if (!result.feasible) throw new Error("expected feasible");

    const [value, balanced, premium] = result.tiers;
    expect(value.totalPriceCents).toBe(260000);
    expect(balanced.totalPriceCents).toBe(330000);
    expect(premium.totalPriceCents).toBe(390000);
    expect(value.totalPriceCents).toBeLessThanOrEqual(balanced.totalPriceCents);
    expect(balanced.totalPriceCents).toBeLessThanOrEqual(premium.totalPriceCents);
  });

  it("picks the expected item per tier, matching t8's greedy order at each cap", () => {
    const result = generateTiers(CATALOG, ROOM, 400000, "minimalist-modern");
    if (!result.feasible) throw new Error("expected feasible");
    const [value, balanced, premium] = result.tiers;

    expect(value.items.toilet!.productId).toBe("toilet-exp");
    expect(value.items.vanity!.productId).toBe("vanity-cheap");
    expect(value.items.shower!.productId).toBe("shower-cheap");

    expect(balanced.items.shower!.productId).toBe("shower-exp");
    expect(balanced.items.toilet!.productId).toBe("toilet-exp");
    expect(balanced.items.vanity!.productId).toBe("vanity-cheap");

    expect(premium.items.shower!.productId).toBe("shower-exp");
    expect(premium.items.vanity!.productId).toBe("vanity-exp");
    expect(premium.items.toilet!.productId).toBe("toilet-exp");
  });

  it("labels each tier correctly and carries the original budget, not the tier's cap", () => {
    const result = generateTiers(CATALOG, ROOM, 400000, "minimalist-modern");
    if (!result.feasible) throw new Error("expected feasible");
    const [value, balanced, premium] = result.tiers;
    expect(value.tier).toBe("value");
    expect(balanced.tier).toBe("balanced");
    expect(premium.tier).toBe("premium");
    [value, balanced, premium].forEach((b) => expect(b.budgetCents).toBe(400000));
  });

  it("has zero warnings in a well-spaced room with no compatibility conflicts", () => {
    const result = generateTiers(CATALOG, ROOM, 400000, "minimalist-modern");
    if (!result.feasible) throw new Error("expected feasible");
    result.tiers.forEach((bundle) => expect(bundle.warnings).toEqual([]));
  });

  it("gives faucet and lighting the vanity's plumbing position, having no rough-in of their own", () => {
    const result = generateTiers(CATALOG, ROOM, 400000, "minimalist-modern");
    if (!result.feasible) throw new Error("expected feasible");
    const [value] = result.tiers;
    expect(value.items.faucet!.placement.position).toEqual(value.items.vanity!.placement.position);
    expect(value.items.lighting!.placement.position).toEqual(value.items.vanity!.placement.position);
  });

  it("sets sustainabilityScore from t9's water-efficiency sub-score", () => {
    const result = generateTiers(CATALOG, ROOM, 400000, "minimalist-modern");
    if (!result.feasible) throw new Error("expected feasible");
    result.tiers.forEach((bundle) => {
      expect(bundle.sustainabilityScore).toBeGreaterThanOrEqual(0);
      expect(bundle.sustainabilityScore).toBeLessThanOrEqual(1);
    });
  });

  it("is infeasible with the true baseline cost when the budget is below it", () => {
    const result = generateTiers(CATALOG, ROOM, 100000, "minimalist-modern");
    expect(result.feasible).toBe(false);
    if (result.feasible || result.reason !== "over-budget") throw new Error("expected over-budget");
    expect(result.cheapestPossibleCents).toBe(BASELINE);
  });

  it("is infeasible when the room has no plumbing point for a required floor fixture", () => {
    const roomMissingShower: Room = { ...ROOM, plumbing: ROOM.plumbing.filter((p) => p.category !== "shower") };
    const result = generateTiers(CATALOG, roomMissingShower, 400000, "minimalist-modern");
    expect(result.feasible).toBe(false);
    if (result.feasible) throw new Error("expected infeasible");
    expect(result.reason).toBe("missing-plumbing-point");
  });

  it("is infeasible when a hard constraint filters a category down to zero options", () => {
    const roomNoFaucets: Room = {
      ...ROOM,
      constraints: [
        {
          id: "c1",
          strength: "hard",
          description: "test",
          rule: { type: "max-install-complexity", level: "drop-in" },
        },
      ],
    };
    // every faucet in CATALOG is "standard" install, so this filters faucet to zero
    const result = generateTiers(CATALOG, roomNoFaucets, 400000, "minimalist-modern");
    expect(result.feasible).toBe(false);
  });
});
