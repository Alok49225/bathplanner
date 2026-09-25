/**
 * Multi-objective scoring — evaluates a complete bundle (t8's output shape)
 * on aesthetic match, water efficiency, and finish/brand coherence. Scores
 * a bundle, doesn't build one; t10 will use this to compare candidates.
 */

import type { Product, ProductCategory, Theme } from "../types/product";
import { PRODUCT_CATEGORIES } from "../types/product";
import { nonNeutralFinishes } from "./compatibility-rules";

export interface BundleScore {
  aestheticMatch: number;
  waterEfficiency: number;
  coherence: number;
  overall: number;
}

export type WaterUsageCategory = "toilet" | "faucet" | "shower";

const WATER_USAGE_CATEGORIES: WaterUsageCategory[] = ["toilet", "faucet", "shower"];

const WATER_REFERENCE: Record<WaterUsageCategory, { best: number; worst: number }> = {
  toilet: { best: 1.0, worst: 1.6 }, // gpf
  faucet: { best: 1.0, worst: 2.2 }, // gpm
  shower: { best: 1.5, worst: 2.5 }, // gpm
};

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function scoreAestheticMatch(items: Partial<Record<ProductCategory, Product>>, targetTheme: Theme): number {
  const scores = PRODUCT_CATEGORIES.map((c) => items[c]?.themeScores[targetTheme]).filter(
    (s): s is number => s !== undefined
  );
  if (scores.length === 0) return 1; // nothing present to score against
  return scores.reduce((sum, s) => sum + s, 0) / scores.length;
}

/**
 * Per-product water efficiency, 0-1, against the same reference bounds the
 * bundle-level average uses. Shared with the rationale generator (t11) so
 * both agree on what "water-efficient" means. Returns null when the
 * category isn't water-relevant or the product has no usage figure.
 */
export function scoreWaterEfficiencyForProduct(
  category: ProductCategory,
  product: Product
): number | null {
  if (!WATER_USAGE_CATEGORIES.includes(category as WaterUsageCategory)) return null;
  const usage = product.waterUsage;
  if (!usage) return null;
  const actual = category === "toilet" ? usage.gpf : usage.gpm;
  if (actual === undefined) return null;
  const { best, worst } = WATER_REFERENCE[category as WaterUsageCategory];
  return clamp01((worst - actual) / (worst - best));
}

function scoreWaterEfficiency(items: Partial<Record<ProductCategory, Product>>): number {
  const applicable = WATER_USAGE_CATEGORIES.map((category) => {
    const product = items[category];
    return product ? scoreWaterEfficiencyForProduct(category, product) : null;
  }).filter((s): s is number => s !== null);

  if (applicable.length === 0) return 1; // nothing to penalize
  return applicable.reduce((sum, s) => sum + s, 0) / applicable.length;
}

function scoreFinishCoherence(products: Product[]): number {
  const excess = nonNeutralFinishes(products).length - 2;
  return excess <= 0 ? 1 : clamp01(1 - 0.25 * excess);
}

function scoreBrandCoherence(products: Product[]): number {
  const brands = new Set(products.map((p) => p.brand));
  return brands.size <= 1 ? 1 : clamp01(1 - 0.25 * (brands.size - 1));
}

export function scoreBundle(items: Partial<Record<ProductCategory, Product>>, targetTheme: Theme): BundleScore {
  const products = PRODUCT_CATEGORIES.map((c) => items[c]).filter((p): p is Product => p !== undefined);

  const aestheticMatch = scoreAestheticMatch(items, targetTheme);
  const waterEfficiency = scoreWaterEfficiency(items);
  const coherence = (scoreFinishCoherence(products) + scoreBrandCoherence(products)) / 2;

  const overall = 0.5 * aestheticMatch + 0.25 * waterEfficiency + 0.25 * coherence;

  return { aestheticMatch, waterEfficiency, coherence, overall };
}
