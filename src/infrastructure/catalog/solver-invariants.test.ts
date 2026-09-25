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
import type { PlumbingPoint, Room } from "../../domain/types/room";
import { generateTiers } from "../../domain/engine/tier-generator";
import { getFootprintEnvelope, placeFixturesWithFallback } from "../../domain/engine/placement-solver";
import type { FloorFixtureCategory } from "../../domain/engine/fit-validator";
import { footprintRect, intersects } from "../../domain/engine/fit-validator";

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

/**
 * P10 — the full pipeline together: real footprint envelopes ->
 * placeFixturesWithFallback's real fallback ladder -> the resulting
 * (possibly partial) plumbing -> generateTiers's own omittedCategories
 * threading, swept across budgets and themes. Every test above exercises
 * generateTiers directly against hand-placed plumbing points that always
 * cover all three floor categories — none of them ever exercise the
 * auto-placement engine itself, or a bundle that's missing a category
 * because the room genuinely couldn't fit it. This closes that gap.
 *
 * Deliberately doesn't assert *which* rung of the fallback ladder a given
 * room lands on — that's exactly the kind of detail this session found
 * shifting with topK/door/window specifics (see placement-solver.ts's own
 * TOP_K_ESCALATION comment). What must hold regardless of which rung wins is
 * self-consistency: whatever generateTiers actually returns must still
 * satisfy every invariant against the room auto-placement actually produced.
 */
function autoPlaceRoom(shell: Room): { room: Room; omitted: FloorFixtureCategory[] } | null {
  const footprints = {
    toilet: getFootprintEnvelope(catalog, "toilet"),
    vanity: getFootprintEnvelope(catalog, "vanity"),
    shower: getFootprintEnvelope(catalog, "shower"),
  };
  const result = placeFixturesWithFallback(shell, footprints);
  if (!result.feasible) return null;

  const plumbing: PlumbingPoint[] = result.placements.map((p) => ({
    id: `plumbing-${p.category}`,
    category: p.category,
    position: p.position,
    wall: p.wall,
  }));
  return { room: { ...shell, plumbing }, omitted: result.omitted };
}

function emptyShell(overrides: Partial<Room> = {}): Room {
  return {
    widthIn: 60,
    lengthIn: 96,
    ceilingHeightIn: 96,
    doors: [],
    windows: [],
    plumbing: [],
    accessibility: {},
    constraints: [],
    ...overrides,
  };
}

describe("Solver invariants — full auto-placement pipeline (real footprints, real fallback ladder)", () => {
  const ROOM_SHELLS: [string, Room][] = [
    ["generous 10x10, empty", emptyShell({ widthIn: 120, lengthIn: 120 })],
    ["blueprint's 5x8 hall bath, empty", emptyShell({ widthIn: 60, lengthIn: 96 })],
    [
      "5x7.5 with an off-corner door and a wide window (this session's reported bug shape)",
      emptyShell({
        widthIn: 60,
        lengthIn: 90,
        doors: [{ id: "d1", wall: "south", offset: 20, widthIn: 28, swing: "right" }],
        windows: [{ id: "w1", wall: "north", offset: 0, widthIn: 40, sillHeightIn: 48 }],
      }),
    ],
    ["very tight 3.5x5, likely forces a fallback drop", emptyShell({ widthIn: 42, lengthIn: 60 })],
  ];

  ROOM_SHELLS.forEach(([label, shell]) => {
    it(`auto-placed room (${label}) holds every generateTiers invariant across the full budget x theme sweep`, () => {
      const placed = autoPlaceRoom(shell);
      if (!placed) {
        // Genuinely infeasible even for a toilet alone — nothing further to check.
        return;
      }
      const { room, omitted } = placed;

      // The solver's own hard invariant: no two of its real placements'
      // envelope footprints physically overlap, checked directly against
      // its actual output geometry, not just trusted by construction.
      for (let i = 0; i < room.plumbing.length; i++) {
        for (let j = i + 1; j < room.plumbing.length; j++) {
          const a = room.plumbing[i];
          const b = room.plumbing[j];
          const envelopeA = getFootprintEnvelope(catalog, a.category);
          const envelopeB = getFootprintEnvelope(catalog, b.category);
          const rectA = footprintRect({ dimensions: envelopeA } as Product, a.position, a.wall);
          const rectB = footprintRect({ dimensions: envelopeB } as Product, b.position, b.wall);
          expect(intersects(rectA, rectB)).toBe(false);
        }
      }

      const cascaded: FloorFixtureCategory[] = [...omitted];
      if (omitted.includes("vanity")) cascaded.push("faucet" as FloorFixtureCategory, "lighting" as FloorFixtureCategory);
      const expectedCategories = PRODUCT_CATEGORIES.filter((c) => !cascaded.includes(c as FloorFixtureCategory));

      THEMES.forEach((theme) => {
        budgetSweep().forEach((budgetCents) => {
          const result = generateTiers(catalog, room, budgetCents, theme, omitted);
          if (!result.feasible) {
            if (result.reason === "over-budget") {
              expect(result.cheapestPossibleCents).toBeGreaterThan(0);
            } else if (result.reason === "no-eligible-options") {
              expect(result.issues.length).toBeGreaterThan(0);
            }
            return;
          }
          result.tiers.forEach((bundle) => {
            expect(bundle.totalPriceCents).toBeLessThanOrEqual(budgetCents);
            expect(Object.keys(bundle.items).sort()).toEqual([...expectedCategories].sort());
            expectedCategories.forEach((category) => {
              expect(catalogIds.has(bundle.items[category]!.productId)).toBe(true);
            });
            bundle.warnings.forEach((w) => expect(w.startsWith("[fit error]")).toBe(false));
          });
        });
      });
    });
  });
});
