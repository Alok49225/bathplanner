import { describe, it, expect } from "vitest";
import { selectWithinBudget } from "./budget-selector";
import type { Product, ProductCategory } from "../types/product";

function makeProduct(id: string, category: ProductCategory, priceCents: number): Product {
  return {
    id,
    category,
    name: id,
    brand: "Kohler",
    priceCents,
    finish: "white",
    dimensions: { width: 10, depth: 10, height: 10 },
    installComplexity: "standard",
    styleTags: [],
    themeScores: { "minimalist-modern": 0.5, "classic-luxury": 0.5, "japanese-zen": 0.5 },
    finishFamily: "test",
  };
}

// cheap/expensive gaps, deliberately distinct so the greedy order is unambiguous:
// shower 70000 > vanity 60000 > toilet 15000 > lighting 13000 > faucet 12000
const CATALOG: Record<ProductCategory, Product[]> = {
  toilet: [makeProduct("toilet-cheap", "toilet", 30000), makeProduct("toilet-exp", "toilet", 45000)],
  vanity: [makeProduct("vanity-cheap", "vanity", 80000), makeProduct("vanity-exp", "vanity", 140000)],
  faucet: [makeProduct("faucet-cheap", "faucet", 20000), makeProduct("faucet-exp", "faucet", 32000)],
  shower: [makeProduct("shower-cheap", "shower", 100000), makeProduct("shower-exp", "shower", 170000)],
  lighting: [makeProduct("lighting-cheap", "lighting", 15000), makeProduct("lighting-exp", "lighting", 28000)],
};
const BASELINE = 30000 + 80000 + 20000 + 100000 + 15000; // 245000

describe("selectWithinBudget", () => {
  it("returns the cheapest-per-category combination when the budget covers only the baseline", () => {
    const result = selectWithinBudget(CATALOG, BASELINE);
    expect(result.feasible).toBe(true);
    if (!result.feasible) throw new Error("expected feasible");
    expect(result.totalPriceCents).toBe(BASELINE);
    expect(result.items.toilet.id).toBe("toilet-cheap");
    expect(result.items.shower.id).toBe("shower-cheap");
  });

  it("reports infeasible with the true cheapest-possible total when budget is below baseline", () => {
    const result = selectWithinBudget(CATALOG, BASELINE - 1);
    expect(result.feasible).toBe(false);
    if (result.feasible || result.reason !== "over-budget") throw new Error("expected over-budget");
    expect(result.cheapestPossibleCents).toBe(BASELINE);
  });

  it("applies exactly the affordable upgrades, largest gain first, multi-round", () => {
    // slack of 55000 over baseline: only toilet(15000), lighting(13000), faucet(12000)
    // fit individually in round 1 (shower 70000 and vanity 60000 don't) — largest
    // affordable gain wins each round, re-evaluated after every swap.
    const budget = BASELINE + 55000; // 300000
    const result = selectWithinBudget(CATALOG, budget);
    expect(result.feasible).toBe(true);
    if (!result.feasible) throw new Error("expected feasible");
    expect(result.items.toilet.id).toBe("toilet-exp");
    expect(result.items.lighting.id).toBe("lighting-exp");
    expect(result.items.faucet.id).toBe("faucet-exp");
    expect(result.items.vanity.id).toBe("vanity-cheap");
    expect(result.items.shower.id).toBe("shower-cheap");
    expect(result.totalPriceCents).toBe(285000);
    expect(result.totalPriceCents).toBeLessThanOrEqual(budget);
  });

  it("prefers the single largest-gain upgrade (shower) when there's room for exactly one", () => {
    const budget = BASELINE + 70000; // exactly shower's gain
    const result = selectWithinBudget(CATALOG, budget);
    expect(result.feasible).toBe(true);
    if (!result.feasible) throw new Error("expected feasible");
    expect(result.items.shower.id).toBe("shower-exp");
    expect(result.items.vanity.id).toBe("vanity-cheap");
    expect(result.totalPriceCents).toBe(BASELINE + 70000);
  });

  it("stacks multiple upgrades when the budget covers all of them", () => {
    const budget = BASELINE + 70000 + 60000 + 15000 + 13000 + 12000; // every upgrade
    const result = selectWithinBudget(CATALOG, budget);
    expect(result.feasible).toBe(true);
    if (!result.feasible) throw new Error("expected feasible");
    expect(result.items.toilet.id).toBe("toilet-exp");
    expect(result.items.vanity.id).toBe("vanity-exp");
    expect(result.items.faucet.id).toBe("faucet-exp");
    expect(result.items.shower.id).toBe("shower-exp");
    expect(result.items.lighting.id).toBe("lighting-exp");
  });

  it("never returns a total that exceeds the budget", () => {
    for (let budget = BASELINE; budget <= BASELINE + 250000; budget += 17000) {
      const result = selectWithinBudget(CATALOG, budget);
      if (result.feasible) {
        expect(result.totalPriceCents).toBeLessThanOrEqual(budget);
      }
    }
  });

  it("is infeasible when a required category has no eligible products", () => {
    const broken = { ...CATALOG, lighting: [] };
    const result = selectWithinBudget(broken, 10_000_000);
    expect(result.feasible).toBe(false);
    if (result.feasible) throw new Error("expected infeasible");
    expect(result.reason).toBe("no-eligible-options");
    if (result.reason === "no-eligible-options") expect(result.category).toBe("lighting");
  });

  describe("with a pinned category", () => {
    it("forces the pinned product in even though it's not the cheapest", () => {
      const toiletExp = CATALOG.toilet[1]; // toilet-exp, 45000
      const budget = BASELINE + 15000; // exactly the pin's extra cost over toilet-cheap
      const result = selectWithinBudget(CATALOG, budget, { toilet: toiletExp });
      expect(result.feasible).toBe(true);
      if (!result.feasible) throw new Error("expected feasible");
      expect(result.items.toilet.id).toBe("toilet-exp");
      expect(result.totalPriceCents).toBe(BASELINE + 15000);
    });

    it("never swaps the pinned category, even with budget to spare", () => {
      const toiletCheap = CATALOG.toilet[0];
      const budget = BASELINE + 70000 + 60000 + 15000 + 13000 + 12000; // room for every upgrade
      const result = selectWithinBudget(CATALOG, budget, { toilet: toiletCheap });
      expect(result.feasible).toBe(true);
      if (!result.feasible) throw new Error("expected feasible");
      expect(result.items.toilet.id).toBe("toilet-cheap"); // stays pinned, not upgraded
      expect(result.items.vanity.id).toBe("vanity-exp"); // everything else still upgrades fully
      expect(result.items.shower.id).toBe("shower-exp");
    });

    it("doesn't require the pinned category to have any eligible options of its own", () => {
      const pinnedProduct = makeProduct("one-off-toilet", "toilet", 40000);
      const broken = { ...CATALOG, toilet: [] }; // t4 would never actually produce this, but defend anyway
      const result = selectWithinBudget(broken, BASELINE + 10000, { toilet: pinnedProduct });
      expect(result.feasible).toBe(true);
      if (!result.feasible) throw new Error("expected feasible");
      expect(result.items.toilet.id).toBe("one-off-toilet");
    });

    it("reports the pin's own cost in cheapestPossibleCents when even the pinned baseline is unaffordable", () => {
      const showerExp = CATALOG.shower[1]; // 170000, 70000 more than shower-cheap
      const result = selectWithinBudget(CATALOG, BASELINE + 70000 - 1, { shower: showerExp });
      expect(result.feasible).toBe(false);
      if (result.feasible || result.reason !== "over-budget") throw new Error("expected over-budget");
      expect(result.cheapestPossibleCents).toBe(BASELINE + 70000);
    });

    it("behaves identically to no pin at all when pinned is omitted (default stays backward-compatible)", () => {
      const withDefault = selectWithinBudget(CATALOG, BASELINE + 55000);
      const withEmptyPin = selectWithinBudget(CATALOG, BASELINE + 55000, {});
      expect(withDefault).toEqual(withEmptyPin);
    });
  });
});
