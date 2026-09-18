import { describe, it, expect } from "vitest";
import { scoreBundle } from "./bundle-scorer";
import type { Product, ProductCategory } from "../types/product";

function makeProduct(category: ProductCategory, overrides: Partial<Product> = {}): Product {
  return {
    id: `${category}-1`,
    category,
    name: `Test ${category}`,
    brand: "Kohler",
    priceCents: 30000,
    finish: "white",
    dimensions: { width: 10, depth: 10, height: 10 },
    installComplexity: "standard",
    styleTags: [],
    themeScores: { "minimalist-modern": 0.5, "classic-luxury": 0.5, "japanese-zen": 0.5 },
    finishFamily: "test",
    ...overrides,
  };
}

function makeBundle(overrides: Partial<Record<ProductCategory, Partial<Product>>> = {}): Record<ProductCategory, Product> {
  const categories: ProductCategory[] = ["toilet", "vanity", "faucet", "shower", "lighting"];
  const items = {} as Record<ProductCategory, Product>;
  categories.forEach((category) => {
    items[category] = makeProduct(category, overrides[category]);
  });
  return items;
}

describe("scoreBundle", () => {
  it("averages the five products' scores for the target theme", () => {
    const items = makeBundle({
      toilet: { themeScores: { "minimalist-modern": 1, "classic-luxury": 0, "japanese-zen": 0.5 } },
      vanity: { themeScores: { "minimalist-modern": 0.5, "classic-luxury": 0, "japanese-zen": 0.5 } },
      faucet: { themeScores: { "minimalist-modern": 0.5, "classic-luxury": 0, "japanese-zen": 0.5 } },
      shower: { themeScores: { "minimalist-modern": 0.5, "classic-luxury": 0, "japanese-zen": 0.5 } },
      lighting: { themeScores: { "minimalist-modern": 0.5, "classic-luxury": 0, "japanese-zen": 0.5 } },
    });
    const score = scoreBundle(items, "minimalist-modern");
    expect(score.aestheticMatch).toBeCloseTo(0.6); // (1+0.5*4)/5
  });

  it("scores water efficiency at 1 for best-in-class fixtures", () => {
    const items = makeBundle({
      toilet: { waterUsage: { gpf: 1.0 } },
      faucet: { waterUsage: { gpm: 1.0 } },
      shower: { waterUsage: { gpm: 1.5 } },
    });
    expect(scoreBundle(items, "minimalist-modern").waterEfficiency).toBeCloseTo(1);
  });

  it("scores water efficiency at 0 for worst-case fixtures", () => {
    const items = makeBundle({
      toilet: { waterUsage: { gpf: 1.6 } },
      faucet: { waterUsage: { gpm: 2.2 } },
      shower: { waterUsage: { gpm: 2.5 } },
    });
    expect(scoreBundle(items, "minimalist-modern").waterEfficiency).toBeCloseTo(0);
  });

  it("defaults water efficiency to 1 when no product in the bundle has waterUsage", () => {
    const items = makeBundle({
      toilet: { waterUsage: undefined },
      faucet: { waterUsage: undefined },
      shower: { waterUsage: undefined },
    });
    expect(scoreBundle(items, "minimalist-modern").waterEfficiency).toBe(1);
  });

  it("gives full coherence when every product shares a finish family and brand", () => {
    const items = makeBundle(); // all default to finish "white", brand "Kohler"
    expect(scoreBundle(items, "minimalist-modern").coherence).toBe(1);
  });

  it("penalizes coherence when finishes exceed the 2-metal rule, matching t4's logic", () => {
    const items = makeBundle({
      toilet: { finish: "chrome" },
      vanity: { finish: "brushed-gold" },
      faucet: { finish: "oil-rubbed-bronze" },
    });
    const score = scoreBundle(items, "minimalist-modern");
    expect(score.coherence).toBeLessThan(1);
  });

  it("penalizes coherence when brands are mixed", () => {
    const items = makeBundle({ toilet: { brand: "Toto" } });
    const score = scoreBundle(items, "minimalist-modern");
    expect(score.coherence).toBeLessThan(1);
  });

  it("combines the three sub-scores as 0.5/0.25/0.25", () => {
    const items = makeBundle();
    const score = scoreBundle(items, "minimalist-modern");
    const expected = 0.5 * score.aestheticMatch + 0.25 * score.waterEfficiency + 0.25 * score.coherence;
    expect(score.overall).toBeCloseTo(expected);
  });

  it("keeps every sub-score within 0-1", () => {
    const items = makeBundle();
    const score = scoreBundle(items, "japanese-zen");
    [score.aestheticMatch, score.waterEfficiency, score.coherence, score.overall].forEach((s) => {
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(1);
    });
  });
});
