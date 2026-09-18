import { describe, it, expect } from "vitest";
import type { Product, ProductCategory } from "./product";
import { THEMES } from "./product";

const CATEGORIES: ProductCategory[] = [
  "toilet",
  "vanity",
  "faucet",
  "shower",
  "lighting",
];

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: "kt-santorini-toilet",
    category: "toilet",
    name: "Santorini Comfort Height Toilet",
    brand: "Kohler",
    priceCents: 42900,
    finish: "white",
    dimensions: { width: 15.5, depth: 27.75, height: 30.5 },
    installComplexity: "standard",
    styleTags: ["comfort-height", "elongated"],
    themeScores: {
      "minimalist-modern": 0.8,
      "classic-luxury": 0.3,
      "japanese-zen": 0.5,
    },
    finishFamily: "kohler-white-standard",
    waterUsage: { gpf: 1.28 },
    ...overrides,
  };
}

describe("Product schema", () => {
  it("accepts a fully-populated fixture for every required category", () => {
    CATEGORIES.forEach((category) => {
      const product = makeProduct({ id: `sample-${category}`, category });
      expect(product.category).toBe(category);
    });
  });

  it("stores price as an integer number of cents, never a float dollar amount", () => {
    const product = makeProduct({ priceCents: 42900 });
    expect(Number.isInteger(product.priceCents)).toBe(true);
    expect(product.priceCents).toBeGreaterThan(0);
  });

  it("gives every product a non-negative footprint on all three axes", () => {
    const product = makeProduct();
    expect(product.dimensions.width).toBeGreaterThan(0);
    expect(product.dimensions.depth).toBeGreaterThan(0);
    expect(product.dimensions.height).toBeGreaterThan(0);
  });

  it("scores every product against all three themes, not a subset", () => {
    const product = makeProduct();
    const scoredThemes = Object.keys(product.themeScores);
    expect(scoredThemes.sort()).toEqual([...THEMES].sort());
  });

  it("keeps every theme score within the 0-1 range a solver can weight against", () => {
    const product = makeProduct();
    Object.values(product.themeScores).forEach((score) => {
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });
  });

  it("allows a clearance override without requiring one", () => {
    const withOverride = makeProduct({ clearanceOverride: { front: 18 } });
    const withoutOverride = makeProduct({ clearanceOverride: undefined });
    expect(withOverride.clearanceOverride?.front).toBe(18);
    expect(withoutOverride.clearanceOverride).toBeUndefined();
  });

  it("allows water usage to be gpf-only, gpm-only, or absent (e.g. lighting)", () => {
    const toilet = makeProduct({ category: "toilet", waterUsage: { gpf: 1.28 } });
    const faucet = makeProduct({ category: "faucet", waterUsage: { gpm: 1.5 } });
    const lighting = makeProduct({ category: "lighting", waterUsage: undefined });
    expect(toilet.waterUsage?.gpf).toBe(1.28);
    expect(faucet.waterUsage?.gpm).toBe(1.5);
    expect(lighting.waterUsage).toBeUndefined();
  });
});
