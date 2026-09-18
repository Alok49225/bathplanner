/**
 * Product schema — the shape of a single catalog SKU.
 * Consumed by: the demo catalog (t2), compatibility rules (t4),
 * theme scoring (t6), and the solver (t8).
 */

/** The five categories the solver must fill to produce a complete bundle. */
export const PRODUCT_CATEGORIES = [
  "toilet",
  "vanity",
  "faucet",
  "shower",
  "lighting",
] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

export type Finish =
  | "chrome"
  | "brushed-nickel"
  | "matte-black"
  | "polished-brass"
  | "brushed-gold"
  | "oil-rubbed-bronze"
  | "white"
  | "stainless-steel";

export const THEMES = [
  "minimalist-modern",
  "classic-luxury",
  "japanese-zen",
] as const;

export type Theme = (typeof THEMES)[number];

/** Display labels for the three presets — shared so rationale text (t11) and the theme selector UI (t16) never drift apart. */
export const THEME_LABELS: Record<Theme, string> = {
  "minimalist-modern": "Minimalist Modern",
  "classic-luxury": "Classic Luxury",
  "japanese-zen": "Japanese Zen",
};

/**
 * A theme selector's (t16) chosen value — "custom" can't resolve into a
 * Theme without free-text matching that isn't built yet (a separate,
 * not-yet-scheduled feature), so it stays its own variant rather than
 * pretending to be a Theme.
 */
export type ThemeSelection = { kind: "preset"; theme: Theme } | { kind: "custom"; text: string };

/**
 * How disruptive installing this item is on its own — independent of
 * whether it also trips a compatibility flag (t4). Drives "Should"-tier
 * install-complexity warnings in the UI.
 */
export type InstallComplexity = "drop-in" | "standard" | "specialist";

/** Physical envelope a fixture occupies, in inches. Used by the clearance validator (t7). */
export interface Dimensions {
  width: number;
  depth: number;
  height: number;
}

/**
 * Minimum clear floor space this fixture needs in front of / beside it,
 * in inches, independent of its own footprint. Defaults live per-category
 * in the clearance validator (t7); a product only sets this to override
 * that default (e.g. a compact corner toilet).
 */
export interface ClearanceOverride {
  front?: number;
  side?: number;
}

/**
 * Water usage, only meaningful for water-consuming categories
 * (toilet, faucet, shower). Backs the sustainability-scoring feature.
 */
export interface WaterUsage {
  /** Gallons per flush — toilets. */
  gpf?: number;
  /** Gallons per minute — faucets, showers. */
  gpm?: number;
}

/** 0–1 fit score for each theme, populated by the theme-scoring pass (t6). */
export type ThemeScores = Record<Theme, number>;

export interface Product {
  id: string;
  category: ProductCategory;
  name: string;
  brand: string;
  /** Price in whole cents — never float dollars. */
  priceCents: number;
  finish: Finish;
  dimensions: Dimensions;
  clearanceOverride?: ClearanceOverride;
  waterUsage?: WaterUsage;
  installComplexity: InstallComplexity;
  /** Free-text descriptors surfaced in rationale copy, e.g. "wall-mounted", "vessel". */
  styleTags: string[];
  themeScores: ThemeScores;
  /** Compatibility-rule flags (t4) that reference this SKU by id, e.g. finish family. */
  finishFamily: string;
  imageUrl?: string;
}
