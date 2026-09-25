/**
 * Bundle output schema — the solver's contract with everything downstream.
 * Consumed by: t8-t10 (produce it), t11 (fills rationale), t20-t23 (renders
 * placement), t30-t31 (summary/export). Standalone for now — nothing wires
 * to it yet.
 */

import type { ProductCategory } from "./product";
import type { Point } from "./room";

export const BUNDLE_TIERS = ["value", "balanced", "premium"] as const;

export type BundleTier = (typeof BUNDLE_TIERS)[number];

export interface BundleLineItem {
  category: ProductCategory;
  /** t1 Product.id — the catalog stays the single source of truth for the product itself. */
  productId: string;
  placement: {
    position: Point;
  };
  /** Undefined until the rationale generator (t11) runs — never a placeholder string. */
  rationale?: string;
}

export interface Bundle {
  id: string;
  tier: BundleTier;
  /**
   * One line item per category the room could actually accommodate. Usually
   * every ProductCategory is present — a Record rather than an array so a
   * missing or mistyped category is a compile error, not a runtime check
   * every consumer has to remember to run. But a category can be legitimately
   * absent when the room is too small to fit it (see placement-solver.ts's
   * fallback ladder and the `omittedCategories` parameter threaded through
   * the solver) — Partial so that omission is still type-checked by key,
   * never a silent lookup miss a consumer forgets to guard against.
   */
  items: Partial<Record<ProductCategory, BundleLineItem>>;
  /** Sum of the picked products' priceCents — a solver output, not user input. */
  totalPriceCents: number;
  /** The budget ceiling this bundle was solved against. */
  budgetCents: number;
  /** Tight-fit and other non-fatal flags, surfaced rather than discarded. */
  warnings: string[];
  /** 0-1, only once the sustainability-scoring feature exists. */
  sustainabilityScore?: number;
}
