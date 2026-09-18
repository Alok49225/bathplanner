import { describe, it, expect } from "vitest";
import { scoreThemeFit, auditThemeScores } from "./theme-scorer";
import type { Product } from "../types/product";

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: "p1",
    category: "faucet",
    name: "Test Faucet",
    brand: "Kohler",
    priceCents: 30000,
    finish: "chrome",
    dimensions: { width: 2, depth: 6, height: 8 },
    installComplexity: "standard",
    styleTags: [],
    themeScores: { "minimalist-modern": 0.5, "classic-luxury": 0.5, "japanese-zen": 0.5 },
    finishFamily: "test",
    ...overrides,
  };
}

describe("scoreThemeFit", () => {
  it("scores a product with no matching tags or finish at baseline for every theme", () => {
    const product = makeProduct({ styleTags: ["value"], finish: "brushed-nickel" });
    const scores = scoreThemeFit(product);
    expect(scores["minimalist-modern"]).toBeCloseTo(0.3);
    expect(scores["classic-luxury"]).toBeCloseTo(0.3);
    expect(scores["japanese-zen"]).toBeCloseTo(0.3);
  });

  it("scores a strongly minimalist-modern product high on that theme only", () => {
    const product = makeProduct({
      styleTags: ["wall-mount", "minimal", "low-profile"],
      finish: "matte-black",
    });
    const scores = scoreThemeFit(product);
    expect(scores["minimalist-modern"]).toBeCloseTo(1.0);
    expect(scores["classic-luxury"]).toBeCloseTo(0.3);
    expect(scores["japanese-zen"]).toBeCloseTo(0.3);
  });

  it("scores a strongly classic-luxury product high on that theme only", () => {
    const product = makeProduct({
      styleTags: ["traditional", "carved-details"],
      finish: "brushed-gold",
    });
    const scores = scoreThemeFit(product);
    expect(scores["classic-luxury"]).toBeCloseTo(0.85);
    expect(scores["minimalist-modern"]).toBeCloseTo(0.3);
  });

  it("clamps at 1 even when tags and finish would otherwise overshoot", () => {
    const product = makeProduct({
      styleTags: ["minimal", "floating", "wall-hung", "sculptural", "architectural"],
      finish: "matte-black",
    });
    const scores = scoreThemeFit(product);
    expect(scores["minimalist-modern"]).toBe(1);
  });

  it("gives every theme a score, matching the Product schema's Record<Theme, number>", () => {
    const scores = scoreThemeFit(makeProduct());
    expect(Object.keys(scores).sort()).toEqual(
      ["classic-luxury", "japanese-zen", "minimalist-modern"].sort()
    );
  });
});

describe("auditThemeScores", () => {
  it("reports zero delta when authored and derived scores agree", () => {
    const product = makeProduct({
      styleTags: ["value"],
      finish: "brushed-nickel",
      themeScores: { "minimalist-modern": 0.3, "classic-luxury": 0.3, "japanese-zen": 0.3 },
    });
    const audits = auditThemeScores([product]);
    audits.forEach((a) => expect(a.delta).toBeCloseTo(0));
  });

  it("flags a large delta when the authored score contradicts the product's own tags", () => {
    const product = makeProduct({
      id: "suspicious-1",
      styleTags: ["traditional", "carved-details"],
      finish: "oil-rubbed-bronze",
      themeScores: { "minimalist-modern": 0.95, "classic-luxury": 0.1, "japanese-zen": 0.1 },
    });
    const audits = auditThemeScores([product]);
    const mmAudit = audits.find((a) => a.theme === "minimalist-modern");
    expect(mmAudit?.delta).toBeGreaterThan(0.6);
  });

  it("returns one audit row per product per theme", () => {
    const audits = auditThemeScores([makeProduct({ id: "a" }), makeProduct({ id: "b" })]);
    expect(audits).toHaveLength(2 * 3);
  });
});
