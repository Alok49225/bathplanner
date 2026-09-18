/**
 * Rationale generator — one plain-language sentence per line item, chosen
 * by priority (first match wins) rather than combined, matching the NFR
 * that a rationale reads in one sentence. Deterministic template text, not
 * an LLM call — predictable and testable for demo day.
 */

import type { Product, ProductCategory, Theme } from "../types/product";
import { THEME_LABELS } from "../types/product";
import { scoreWaterEfficiencyForProduct } from "./bundle-scorer";

/**
 * Mid-sentence form of THEME_LABELS ("matching your minimalist modern
 * style", not "matching your Minimalist Modern style") — lowercased from
 * the shared title-case labels, except Japanese Zen, which stays
 * capitalized because it's a proper noun even mid-sentence.
 */
const MID_SENTENCE_THEME_LABELS: Record<Theme, string> = {
  "minimalist-modern": THEME_LABELS["minimalist-modern"].toLowerCase(),
  "classic-luxury": THEME_LABELS["classic-luxury"].toLowerCase(),
  "japanese-zen": THEME_LABELS["japanese-zen"],
};

const THEME_MATCH_THRESHOLD = 0.7;
const WATER_EFFICIENCY_THRESHOLD = 0.7;

export function generateRationale(
  product: Product,
  category: ProductCategory,
  targetTheme: Theme,
  categoryOptions: Product[]
): string {
  const themeScore = product.themeScores[targetTheme];
  const topTag = product.styleTags[0];
  const cheapestPrice = Math.min(...categoryOptions.map((p) => p.priceCents));
  const isCheapest = product.priceCents === cheapestPrice;
  const waterScore = scoreWaterEfficiencyForProduct(category, product);

  if (themeScore >= THEME_MATCH_THRESHOLD && topTag) {
    return `The ${product.name} was picked for its ${topTag} look, matching your ${MID_SENTENCE_THEME_LABELS[targetTheme]} style.`;
  }

  if (waterScore !== null && waterScore >= WATER_EFFICIENCY_THRESHOLD) {
    return `The ${product.name} is one of the more water-efficient ${category} options available.`;
  }

  if (isCheapest) {
    return `The ${product.name} is the most budget-friendly ${category} that still fits your room.`;
  }

  if (topTag) {
    return `The ${product.name} was chosen over more affordable options for its ${topTag} styling.`;
  }

  return `The ${product.name} fits your room's requirements and budget.`;
}
