import { describe, it, expect } from "vitest";
import { generateRationale } from "./rationale-generator";
import type { Product } from "../types/product";

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: "p1",
    category: "toilet",
    name: "Santorini",
    brand: "Kohler",
    priceCents: 30000,
    finish: "white",
    dimensions: { width: 16, depth: 28, height: 30 },
    installComplexity: "standard",
    styleTags: [],
    themeScores: { "minimalist-modern": 0.3, "classic-luxury": 0.3, "japanese-zen": 0.3 },
    finishFamily: "test",
    ...overrides,
  };
}

describe("generateRationale", () => {
  it("leads with theme match when the score clears the threshold", () => {
    const product = makeProduct({
      styleTags: ["wall-hung", "minimal"],
      themeScores: { "minimalist-modern": 0.9, "classic-luxury": 0.1, "japanese-zen": 0.1 },
    });
    const text = generateRationale(product, "toilet", "minimalist-modern", [product]);
    expect(text).toContain("wall-hung");
    expect(text).toContain("minimalist modern");
  });

  it("uses the proper display label for japanese-zen", () => {
    const product = makeProduct({
      styleTags: ["spa-style"],
      themeScores: { "minimalist-modern": 0.1, "classic-luxury": 0.1, "japanese-zen": 0.85 },
    });
    const text = generateRationale(product, "toilet", "japanese-zen", [product]);
    expect(text).toContain("Japanese Zen");
  });

  it("falls back to water efficiency when theme doesn't clear the threshold", () => {
    const product = makeProduct({
      category: "toilet",
      waterUsage: { gpf: 1.0 }, // best-in-class -> score 1.0
      themeScores: { "minimalist-modern": 0.3, "classic-luxury": 0.3, "japanese-zen": 0.3 },
    });
    const text = generateRationale(product, "toilet", "minimalist-modern", [product]);
    expect(text).toContain("water-efficient");
  });

  it("falls back to cheapest-in-category when theme and water don't stand out", () => {
    const cheap = makeProduct({ id: "cheap", priceCents: 20000, category: "vanity" });
    const expensive = makeProduct({ id: "exp", priceCents: 50000, category: "vanity" });
    const text = generateRationale(cheap, "vanity", "minimalist-modern", [cheap, expensive]);
    expect(text).toContain("budget-friendly");
  });

  it("explains an upgrade by its style tag when it's not the cheapest and nothing else stands out", () => {
    const cheap = makeProduct({ id: "cheap", priceCents: 20000, category: "vanity" });
    const expensive = makeProduct({
      id: "exp",
      priceCents: 50000,
      category: "vanity",
      styleTags: ["floating"],
    });
    const text = generateRationale(expensive, "vanity", "minimalist-modern", [cheap, expensive]);
    expect(text).toContain("floating");
    expect(text).not.toContain("budget-friendly");
  });

  it("falls back to a generic sentence when nothing stands out and there's no style tag", () => {
    const cheap = makeProduct({ id: "cheap", priceCents: 20000, category: "vanity" });
    const expensive = makeProduct({ id: "exp", priceCents: 50000, category: "vanity", styleTags: [] });
    const text = generateRationale(expensive, "vanity", "minimalist-modern", [cheap, expensive]);
    expect(text).toContain("fits your room's requirements");
  });

  it("never mentions water efficiency for categories that don't carry water usage", () => {
    const product = makeProduct({ category: "lighting", themeScores: { "minimalist-modern": 0.3, "classic-luxury": 0.3, "japanese-zen": 0.3 } });
    const text = generateRationale(product, "lighting", "minimalist-modern", [product]);
    expect(text).not.toContain("water-efficient");
  });

  it("always produces exactly one sentence", () => {
    const product = makeProduct({ styleTags: ["minimal"], themeScores: { "minimalist-modern": 0.9, "classic-luxury": 0.1, "japanese-zen": 0.1 } });
    const text = generateRationale(product, "toilet", "minimalist-modern", [product]);
    expect(text.match(/\./g)?.length).toBe(1);
  });
});
