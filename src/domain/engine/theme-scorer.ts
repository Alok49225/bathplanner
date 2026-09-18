/**
 * Theme-fit scorer — audits the catalog's hand-authored themeScores (t2)
 * against a derived score, rather than replacing them. Curated intent stays
 * authoritative; this exists to catch data-entry mistakes and to explain,
 * in one sentence, why a score looks the way it does.
 */

import type { Product, Theme } from "../types/product";
import { THEMES } from "../types/product";

const BASELINE = 0.3;
const TAG_WEIGHT = 0.15;

const TAG_SIGNALS: Record<Theme, string[]> = {
  "minimalist-modern": [
    "minimal", "floating", "wall-hung", "wall-mount", "wall-mounted",
    "concealed-tank", "low-profile", "low-profile-tank", "linear-glass",
    "linear-pulls", "led", "bar-light", "sculptural", "architectural",
    "contemporary", "ceiling-mount", "flush-mount", "curved-silhouette",
    "digital-control",
  ],
  "classic-luxury": [
    "traditional", "carved-details", "cross-handles", "cross-handle",
    "bridge", "raised-panel", "cherry-finish", "candlestick-style",
    "hatbox", "high-arc", "column", "shaker-cabinet",
  ],
  "japanese-zen": [
    "spa-style", "teak", "curbless", "curbless-compatible", "soft-glow",
    "paper-lantern-inspired", "round-tank", "rain-head", "handshower",
  ],
};

const FINISH_BONUS: Record<Theme, Partial<Record<Product["finish"], number>>> = {
  "minimalist-modern": { "matte-black": 0.25, chrome: 0.15, "stainless-steel": 0.15 },
  "classic-luxury": { "brushed-gold": 0.25, "oil-rubbed-bronze": 0.25, "polished-brass": 0.25 },
  "japanese-zen": { "stainless-steel": 0.15, "brushed-gold": 0.08, white: 0.08 },
};

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

export function scoreThemeFit(product: Product): Record<Theme, number> {
  const scores = {} as Record<Theme, number>;
  for (const theme of THEMES) {
    const tagMatches = product.styleTags.filter((tag) => TAG_SIGNALS[theme].includes(tag)).length;
    const finishBonus = FINISH_BONUS[theme][product.finish] ?? 0;
    scores[theme] = clamp01(BASELINE + tagMatches * TAG_WEIGHT + finishBonus);
  }
  return scores;
}

export interface ThemeScoreAudit {
  productId: string;
  theme: Theme;
  authoredScore: number;
  derivedScore: number;
  delta: number;
}

export function auditThemeScores(catalog: Product[]): ThemeScoreAudit[] {
  const audits: ThemeScoreAudit[] = [];
  for (const product of catalog) {
    const derived = scoreThemeFit(product);
    for (const theme of THEMES) {
      const authoredScore = product.themeScores[theme];
      const derivedScore = derived[theme];
      const delta = Math.abs(authoredScore - derivedScore);
      audits.push({ productId: product.id, theme, authoredScore, derivedScore, delta });
    }
  }
  return audits;
}
