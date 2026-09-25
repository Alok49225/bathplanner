/**
 * t13 — solver test suite. Unlike the per-module unit tests elsewhere
 * (t4/t7/t8/t9/t10/t11 fixtures), this sweeps the real 42-SKU catalog
 * across a range of budgets, themes, and two real room sizes — including
 * the blueprint's own 5'x8' example — checking the three invariants the
 * board named: budget never exceeded, no missing category, no clearance
 * violation.
 */

import { describe, it, expect } from "vitest";
import catalogData from "./generated/catalog.json";
import type { Product, Theme } from "../../domain/types/product";
import { PRODUCT_CATEGORIES, THEMES } from "../../domain/types/product";
import type { Room } from "../../domain/types/room";
import { generateTiers } from "../../domain/engine/tier-generator";

const catalog = catalogData as Product[];
const catalogIds = new Set(catalog.map((p) => p.id));

// Spacious and well-separated — proves the invariants hold with real data
// when the room isn't the limiting factor.
const GENEROUS_ROOM: Room = {
  widthIn: 300,
  lengthIn: 300,
  ceilingHeightIn: 96,
  doors: [],
  windows: [],
  plumbing: [
    { id: "toilet-point", category: "toilet", position: { x: 30, y: 290 }, wall: "south" },
    { id: "vanity-point", category: "vanity", position: { x: 150, y: 290 }, wall: "south" },
    { id: "shower-point", category: "shower", position: { x: 30, y: 30 }, wall: "north" },
  ],
  accessibility: {},
  constraints: [],
};

// The blueprint's own worked example (Vision section: "her exact 5'x8'
// room") — tight enough that some real catalog SKUs (e.g. 48in vanities)
// genuinely can't fit, which is exactly what t4's canFit pre-filter (added
// this task) is supposed to catch before the solver ever considers them.
const HALL_BATH_ROOM: Room = {
  widthIn: 60,
  lengthIn: 96,
  ceilingHeightIn: 96,
  doors: [],
  windows: [],
  plumbing: [
    { id: "toilet-point", category: "toilet", position: { x: 10, y: 90 }, wall: "south" },
    { id: "vanity-point", category: "vanity", position: { x: 32, y: 90 }, wall: "south" },
    { id: "shower-point", category: "shower", position: { x: 45, y: 10 }, wall: "north" },
  ],
  accessibility: {},
  constraints: [],
};

const BUDGET_STEP_CENTS = 50_000; // $500
const MIN_BUDGET_CENTS = 150_000; // $1,500
const MAX_BUDGET_CENTS = 1_000_000; // $10,000

function budgetSweep(): number[] {
  const budgets: number[] = [];
  for (let b = MIN_BUDGET_CENTS; b <= MAX_BUDGET_CENTS; b += BUDGET_STEP_CENTS) budgets.push(b);
  return budgets;
}

function checkInvariants(room: Room, budgetCents: number, theme: Theme) {
  const result = generateTiers(catalog, room, budgetCents, theme);

  if (!result.feasible) {
    // Never crashes; always reports a real, distinguishable reason —
    // "over-budget" carries a sane finite shortfall, "no-eligible-options"
    // carries the actual compatibility issues instead of a bare number.
    if (result.reason === "over-budget") {
      expect(result.cheapestPossibleCents).toBeGreaterThan(0);
    } else if (result.reason === "no-eligible-options") {
      expect(result.issues.length).toBeGreaterThan(0);
    }
    return;
  }

  result.tiers.forEach((bundle) => {
    // Invariant 1: budget never exceeded.
    expect(bundle.totalPriceCents).toBeLessThanOrEqual(budgetCents);

    // Invariant 2: no missing category, every pick is a real catalog id.
    expect(Object.keys(bundle.items).sort()).toEqual([...PRODUCT_CATEGORIES].sort());
    PRODUCT_CATEGORIES.forEach((category) => {
      expect(catalogIds.has(bundle.items[category]!.productId)).toBe(true);
    });

    // Invariant 3: no clearance violation — a hard fit error must never
    // reach a bundle that's actually shown. Soft tight-fit warnings are
    // allowed (the hall bath will legitimately produce some).
    bundle.warnings.forEach((w) => expect(w.startsWith("[fit error]")).toBe(false));
  });
}

describe("Solver invariants — generous room, full budget x theme sweep", () => {
  THEMES.forEach((theme) => {
    it(`holds for every budget from $1,500 to $10,000 at ${theme}`, () => {
      budgetSweep().forEach((budgetCents) => checkInvariants(GENEROUS_ROOM, budgetCents, theme));
    });
  });
});

describe("Solver invariants — blueprint's 5'x8' hall bath, full budget x theme sweep", () => {
  THEMES.forEach((theme) => {
    it(`holds for every budget from $1,500 to $10,000 at ${theme}`, () => {
      budgetSweep().forEach((budgetCents) => checkInvariants(HALL_BATH_ROOM, budgetCents, theme));
    });
  });

  it("actually excludes at least one real vanity SKU that's too wide for the room (proves the t4 fit pre-filter, not just a passing coincidence)", () => {
    const tooWideForHallBath = catalog.filter((p) => p.category === "vanity" && p.dimensions.width > 40);
    expect(tooWideForHallBath.length).toBeGreaterThan(0); // sanity: such a SKU exists in the real catalog

    const result = generateTiers(catalog, HALL_BATH_ROOM, MAX_BUDGET_CENTS, "classic-luxury");
    expect(result.feasible).toBe(true);
    if (!result.feasible) return;
    result.tiers.forEach((bundle) => {
      expect(tooWideForHallBath.some((p) => p.id === bundle.items.vanity!.productId)).toBe(false);
    });
  });
});
