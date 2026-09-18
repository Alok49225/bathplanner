import { describe, it, expect } from "vitest";
import { pinAndResolve } from "./pin-resolve";
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

// Same distinct gaps used throughout the engine tests.
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

describe("pinAndResolve", () => {
  it("keeps the pinned product and re-optimizes the rest within the same overall budget", () => {
    const budget = BASELINE + 70000 + 60000; // enough for shower + vanity upgrades normally
    // Pin toilet to the expensive option — something the unpinned solver wouldn't
    // have picked at this budget (its gain, 15000, isn't the priority here).
    const result = pinAndResolve(CATALOG, ROOM, budget, "minimalist-modern", "balanced", "toilet", "toilet-exp");
    expect(result.feasible).toBe(true);
    if (!result.feasible) throw new Error("expected feasible");
    expect(result.bundle.items.toilet.productId).toBe("toilet-exp");
    expect(result.bundle.totalPriceCents).toBeLessThanOrEqual(budget);
    expect(result.bundle.budgetCents).toBe(budget); // ceiling stays the original budget, not a shrunk one
  });

  it("produces a bundle with the same shape as generateTiers — rationale, placement, tier label", () => {
    const result = pinAndResolve(CATALOG, ROOM, BASELINE + 50000, "japanese-zen", "value", "vanity", "vanity-cheap");
    expect(result.feasible).toBe(true);
    if (!result.feasible) throw new Error("expected feasible");
    expect(result.bundle.tier).toBe("value");
    expect(result.bundle.items.vanity.rationale).toBeTruthy();
    expect(result.bundle.items.toilet.placement.position).toBeDefined();
    expect(Object.keys(result.bundle.items).sort()).toEqual(
      ["faucet", "lighting", "shower", "toilet", "vanity"].sort()
    );
  });

  it("is infeasible when the pin itself plus the cheapest of everything else exceeds budget", () => {
    const result = pinAndResolve(CATALOG, ROOM, 100000, "minimalist-modern", "value", "shower", "shower-exp");
    expect(result.feasible).toBe(false);
    if (result.feasible) throw new Error("expected infeasible");
    expect(result.reason).toBe("over-budget");
  });

  it("is infeasible when the pinned product id doesn't exist in the catalog", () => {
    const result = pinAndResolve(CATALOG, ROOM, 1_000_000, "minimalist-modern", "value", "toilet", "no-such-id");
    expect(result.feasible).toBe(false);
    if (result.feasible) throw new Error("expected infeasible");
    expect(result.reason).toBe("invalid-pin");
  });

  it("is infeasible when the pinned product's category doesn't match", () => {
    // toilet-cheap exists, but not as a vanity
    const result = pinAndResolve(CATALOG, ROOM, 1_000_000, "minimalist-modern", "value", "vanity", "toilet-cheap");
    expect(result.feasible).toBe(false);
    if (result.feasible) throw new Error("expected infeasible");
    expect(result.reason).toBe("invalid-pin");
  });

  it("is infeasible with the real reason when the room is missing a required plumbing point", () => {
    const roomMissingShower: Room = { ...ROOM, plumbing: ROOM.plumbing.filter((p) => p.category !== "shower") };
    const result = pinAndResolve(CATALOG, roomMissingShower, 1_000_000, "minimalist-modern", "value", "toilet", "toilet-cheap");
    expect(result.feasible).toBe(false);
    if (result.feasible) throw new Error("expected infeasible");
    expect(result.reason).toBe("missing-plumbing-point");
  });

  it("never re-selects the pinned category even with a generous budget", () => {
    const bigBudget = 1_000_000;
    const result = pinAndResolve(CATALOG, ROOM, bigBudget, "minimalist-modern", "premium", "toilet", "toilet-cheap");
    expect(result.feasible).toBe(true);
    if (!result.feasible) throw new Error("expected feasible");
    expect(result.bundle.items.toilet.productId).toBe("toilet-cheap");
    // everything else should still be free to upgrade at this budget
    expect(result.bundle.items.shower.productId).toBe("shower-exp");
    expect(result.bundle.items.vanity.productId).toBe("vanity-exp");
  });
});
