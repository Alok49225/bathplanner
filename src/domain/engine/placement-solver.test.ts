import { describe, it, expect } from "vitest";
import {
  getFootprintEnvelope,
  generateWallCandidates,
  generateCandidates,
  scoreCandidate,
  solvePlacement,
  placementSortKey,
  placeFixturesWithFallback,
  type PlacedFixture,
  type PlacementResult,
} from "./placement-solver";
import { footprintRect, intersects, type FloorFixtureCategory } from "./fit-validator";
import type { Product, Dimensions } from "../types/product";
import type { Room } from "../types/room";

function makeRoom(overrides: Partial<Room> = {}): Room {
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

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: "p1",
    category: "toilet",
    name: "Test Product",
    brand: "Kohler",
    priceCents: 10000,
    finish: "white",
    dimensions: { width: 16, depth: 28, height: 30 },
    installComplexity: "standard",
    styleTags: [],
    themeScores: { "minimalist-modern": 0.5, "classic-luxury": 0.5, "japanese-zen": 0.5 },
    finishFamily: "test",
    ...overrides,
  };
}

describe("getFootprintEnvelope", () => {
  it("takes the max width and max depth independently across all products in a category", () => {
    const catalog: Product[] = [
      makeProduct({ id: "t1", category: "toilet", dimensions: { width: 14, depth: 30, height: 30 } }),
      makeProduct({ id: "t2", category: "toilet", dimensions: { width: 16, depth: 22, height: 28 } }),
    ];
    // widest is t2 (16), deepest is t1 (30) -- envelope must combine both,
    // even though no single real product is 16 wide AND 30 deep.
    const envelope = getFootprintEnvelope(catalog, "toilet");
    expect(envelope.width).toBe(16);
    expect(envelope.depth).toBe(30);
  });

  it("returns an envelope at least as large as every individual product's own width and depth", () => {
    const catalog: Product[] = [
      makeProduct({ id: "v1", category: "vanity", dimensions: { width: 22, depth: 19, height: 34 } }),
      makeProduct({ id: "v2", category: "vanity", dimensions: { width: 48, depth: 22, height: 34 } }),
      makeProduct({ id: "v3", category: "vanity", dimensions: { width: 30, depth: 21, height: 34 } }),
    ];
    const envelope = getFootprintEnvelope(catalog, "vanity");
    for (const p of catalog) {
      expect(envelope.width).toBeGreaterThanOrEqual(p.dimensions.width);
      expect(envelope.depth).toBeGreaterThanOrEqual(p.dimensions.depth);
    }
  });

  it("ignores products from other categories", () => {
    const catalog: Product[] = [
      makeProduct({ id: "t1", category: "toilet", dimensions: { width: 16, depth: 28, height: 30 } }),
      makeProduct({ id: "s1", category: "shower", dimensions: { width: 60, depth: 32, height: 4 } }),
    ];
    const envelope = getFootprintEnvelope(catalog, "toilet");
    expect(envelope.width).toBe(16);
    expect(envelope.depth).toBe(28);
  });

  it("reserves a realistic shower-stall footprint even though most shower SKUs are small trim hardware", () => {
    const catalog: Product[] = [
      makeProduct({ id: "trim", category: "shower", dimensions: { width: 6, depth: 4, height: 8 } }),
      makeProduct({ id: "base", category: "shower", dimensions: { width: 60, depth: 32, height: 4 } }),
    ];
    const envelope = getFootprintEnvelope(catalog, "shower");
    expect(envelope.width).toBe(60);
    expect(envelope.depth).toBe(32);
  });

  it("throws when the category has no products at all", () => {
    const catalog: Product[] = [makeProduct({ id: "t1", category: "toilet" })];
    expect(() => getFootprintEnvelope(catalog, "vanity")).toThrow();
  });
});

describe("generateWallCandidates", () => {
  it("splits a wall into open segments around a door and never straddles the gap", () => {
    const room = makeRoom({
      doors: [{ id: "d1", wall: "north", offset: 20, widthIn: 10, swing: "left" }],
    });
    const footprint = { width: 10, depth: 20, height: 30 };
    const candidates = generateWallCandidates(room, footprint, "north", 2);

    expect(candidates.length).toBe(17); // 6 in [0,20) + 11 in [30,60)
    for (const { position } of candidates) {
      const overlapsDoor = position.x + footprint.width > 20 && position.x < 30;
      expect(overlapsDoor).toBe(false);
    }
  });

  it("yields zero candidates when a door leaves a gap too narrow for the footprint", () => {
    const room = makeRoom({
      doors: [{ id: "d1", wall: "north", offset: 0, widthIn: 55, swing: "left" }],
    });
    const footprint = { width: 10, depth: 20, height: 30 };
    expect(generateWallCandidates(room, footprint, "north", 2)).toEqual([]);
  });

  it("yields zero candidates when the footprint is deeper than the room's other dimension", () => {
    const room = makeRoom({ widthIn: 60, lengthIn: 96 });
    const footprint = { width: 10, depth: 100, height: 30 };
    expect(generateWallCandidates(room, footprint, "north", 2)).toEqual([]);
  });

  it("respects the step size on an open wall", () => {
    const room = makeRoom();
    const footprint = { width: 10, depth: 20, height: 30 };
    const candidates = generateWallCandidates(room, footprint, "north", 5);
    expect(candidates.length).toBe(11); // along = 0,5,...,50
  });

  it("blocks a wall segment for a window exactly the same way it does for a door", () => {
    const room = makeRoom({
      windows: [{ id: "w1", wall: "north", offset: 20, widthIn: 10, sillHeightIn: 36 }],
    });
    const footprint = { width: 10, depth: 20, height: 30 };
    const candidates = generateWallCandidates(room, footprint, "north", 2);

    expect(candidates.length).toBe(17); // 6 in [0,20) + 11 in [30,60), same shape as the door test above
    for (const { position } of candidates) {
      const overlapsWindow = position.x + footprint.width > 20 && position.x < 30;
      expect(overlapsWindow).toBe(false);
    }
  });

  it("merges an overlapping door and window into a single blocked span, not two independent ones", () => {
    const room = makeRoom({
      doors: [{ id: "d1", wall: "north", offset: 15, widthIn: 20, swing: "left" }], // blocks [15,35)
      windows: [{ id: "w1", wall: "north", offset: 30, widthIn: 15, sillHeightIn: 36 }], // blocks [30,45), overlaps the door's tail
    });
    const footprint = { width: 10, depth: 20, height: 30 };
    const candidates = generateWallCandidates(room, footprint, "north", 2);

    for (const { position } of candidates) {
      const overlapsBlocked = position.x + footprint.width > 15 && position.x < 45;
      expect(overlapsBlocked).toBe(false);
    }
  });
});

describe("generateCandidates", () => {
  it("produces positions that plug directly into footprintRect and always stay within room bounds", () => {
    const room = makeRoom({
      widthIn: 60,
      lengthIn: 96,
      doors: [
        { id: "dn", wall: "north", offset: 5, widthIn: 8, swing: "left" },
        { id: "ds", wall: "south", offset: 5, widthIn: 8, swing: "left" },
        { id: "de", wall: "east", offset: 5, widthIn: 8, swing: "left" },
        { id: "dw", wall: "west", offset: 5, widthIn: 8, swing: "left" },
      ],
    });
    const footprint = { width: 10, depth: 20, height: 30 };
    const candidates = generateCandidates(room, footprint, 4);
    expect(candidates.length).toBeGreaterThan(0);

    const fakeProduct = { dimensions: footprint } as Product;
    for (const { position, wall } of candidates) {
      const rect = footprintRect(fakeProduct, position, wall);
      expect(rect.x1).toBeGreaterThanOrEqual(0);
      expect(rect.y1).toBeGreaterThanOrEqual(0);
      expect(rect.x2).toBeLessThanOrEqual(room.widthIn);
      expect(rect.y2).toBeLessThanOrEqual(room.lengthIn);
    }
  });
});

describe("scoreCandidate", () => {
  const footprint = { width: 10, depth: 20, height: 30 };

  it("hard-rejects (null) a candidate whose footprint overlaps an already-placed fixture, regardless of clearance/corner quality", () => {
    const room = makeRoom({ widthIn: 60, lengthIn: 96 });
    const candidate = { position: { x: 20, y: 0 }, wall: "north" as const };
    const alreadyPlaced: PlacedFixture[] = [
      { wall: "north", footprint: { x1: 15, y1: 0, x2: 25, y2: 20 } },
    ];
    expect(scoreCandidate(room, candidate, footprint, "toilet", alreadyPlaced)).toBeNull();
  });

  it("hard-rejects (null) a candidate whose footprint overlaps a door's swing zone, even with nothing else placed yet", () => {
    const room = makeRoom({
      widthIn: 60,
      lengthIn: 96,
      doors: [{ id: "d1", wall: "south", offset: 0, widthIn: 28, swing: "right" }],
    });
    // Flush against the door's own edge on the same wall — openSegments
    // alone would allow this (it's past the door's own [0,28) span), but
    // the door swings a quarter-circle of radius 28 into the room from
    // there, which this candidate's footprint sits squarely inside.
    const candidate = { position: { x: 28, y: 96 }, wall: "south" as const };
    expect(scoreCandidate(room, candidate, footprint, "toilet", [])).toBeNull();
  });

  it("doesn't penalize a candidate nowhere near any door's swing zone", () => {
    const room = makeRoom({
      widthIn: 60,
      lengthIn: 96,
      doors: [{ id: "d1", wall: "south", offset: 0, widthIn: 28, swing: "right" }],
    });
    const candidate = { position: { x: 0, y: 0 }, wall: "north" as const }; // far side of the room
    expect(scoreCandidate(room, candidate, footprint, "toilet", [])).not.toBeNull();
  });

  it("scores a fully-clear, dead-center, first-placed candidate at exactly 1.0", () => {
    const room = makeRoom({ widthIn: 60, lengthIn: 96 });
    // along = (span - width) / 2 = (60 - 10) / 2 = 25 -> true dead-center
    const candidate = { position: { x: 25, y: 0 }, wall: "north" as const };
    const score = scoreCandidate(room, candidate, footprint, "toilet", []);
    expect(score).toBeCloseTo(1.0, 5);
  });

  it("scores a tight-clearance candidate at 0.4 instead of a hard rejection", () => {
    // A narrow room where the clearance zone (side=15 for a toilet) can't
    // help but bust the room's own bounds, even though the footprint itself
    // fits fine.
    const room = makeRoom({ widthIn: 30, lengthIn: 96 });
    const candidate = { position: { x: 10, y: 0 }, wall: "north" as const };
    const score = scoreCandidate(room, candidate, footprint, "toilet", []);
    expect(score).toBeCloseTo(0.4, 5);
  });

  it("adds exactly the wall-share bonus when sharing a wall with an already-placed fixture that doesn't intrude on clearance", () => {
    const room = makeRoom({ widthIn: 60, lengthIn: 96 });
    const candidate = { position: { x: 25, y: 0 }, wall: "north" as const };
    const alreadyPlaced: PlacedFixture[] = [
      { wall: "north", footprint: { x1: 55, y1: 0, x2: 59, y2: 5 } },
    ];
    const baseline = scoreCandidate(room, candidate, footprint, "toilet", []);
    const withShare = scoreCandidate(room, candidate, footprint, "toilet", alreadyPlaced);
    expect(withShare).toBeCloseTo((baseline as number) + 0.15, 5);
  });

  it("scores a near-corner candidate higher than a dead-center one, all else equal", () => {
    const room = makeRoom({ widthIn: 60, lengthIn: 96 });
    const center = scoreCandidate(room, { position: { x: 25, y: 0 }, wall: "north" }, footprint, "toilet", []);
    const nearCorner = scoreCandidate(room, { position: { x: 15, y: 0 }, wall: "north" }, footprint, "toilet", []);
    expect(nearCorner as number).toBeGreaterThan(center as number);
  });
});

describe("placementSortKey", () => {
  it("ranks a bigger, tighter-clearance footprint ahead of a smaller one", () => {
    const bigShower = { width: 60, depth: 32, height: 4 };
    const smallToilet = { width: 16, depth: 28, height: 30 };
    expect(placementSortKey(bigShower, "shower")).toBeGreaterThan(placementSortKey(smallToilet, "toilet"));
  });
});

describe("solvePlacement", () => {
  it("finds a valid, fully non-overlapping combination in a spacious room", () => {
    const room = makeRoom({ widthIn: 96, lengthIn: 120 });
    const footprints: Record<FloorFixtureCategory, Dimensions> = {
      toilet: { width: 16, depth: 28, height: 30 },
      vanity: { width: 30, depth: 21, height: 34 },
      shower: { width: 32, depth: 32, height: 78 },
    };
    const result = solvePlacement(room, ["toilet", "vanity", "shower"], footprints);
    expect(result).not.toBeNull();
    const placed = result as PlacementResult[];
    expect(placed.length).toBe(3);

    const rects = placed.map((p) =>
      footprintRect({ dimensions: footprints[p.category] } as Product, p.position, p.wall),
    );
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        expect(intersects(rects[i], rects[j])).toBe(false);
      }
    }
  });

  it("finds a valid joint combination even when both categories' independently-best spot would collide", () => {
    // Only the north wall is usable: south is fully blocked, and east/west
    // are too short (span = lengthIn = 30) for either footprint's width.
    // Both fixtures' independently-best (dead-center) spot on north land in
    // heavily overlapping ranges, forcing the search to shift one. A window
    // (not a door) blocks south here deliberately — a door this wide would
    // also carry a same-width swing zone (doorSwingRect) reaching clear
    // across this shallow a room and swallowing north too, which isn't what
    // this test is about; a window blocks the wall segment the identical
    // way without a swing path to model.
    const room = makeRoom({
      widthIn: 60,
      lengthIn: 30,
      windows: [{ id: "w1", wall: "south", offset: 0, widthIn: 60, sillHeightIn: 48 }],
    });
    const footprints: Record<FloorFixtureCategory, Dimensions> = {
      toilet: { width: 16, depth: 28, height: 30 },
      vanity: { width: 24, depth: 21, height: 34 },
      shower: { width: 20, depth: 28, height: 78 },
    };
    const result = solvePlacement(room, ["vanity", "shower"], footprints);
    expect(result).not.toBeNull();
    const placed = result as PlacementResult[];
    expect(placed.length).toBe(2);
    expect(placed.every((p) => p.wall === "north")).toBe(true);

    const rects = placed.map((p) =>
      footprintRect({ dimensions: footprints[p.category] } as Product, p.position, p.wall),
    );
    expect(intersects(rects[0], rects[1])).toBe(false);
  });

  it("returns null when a category has no viable candidates anywhere in the room", () => {
    const room = makeRoom({ widthIn: 60, lengthIn: 90 });
    const footprints: Record<FloorFixtureCategory, Dimensions> = {
      toilet: { width: 200, depth: 10, height: 30 },
      vanity: { width: 24, depth: 21, height: 34 },
      shower: { width: 20, depth: 28, height: 78 },
    };
    expect(solvePlacement(room, ["toilet"], footprints)).toBeNull();
  });
});

describe("placeFixturesWithFallback", () => {
  const room = makeRoom({ widthIn: 60, lengthIn: 96 });
  const reasonable: Record<FloorFixtureCategory, Dimensions> = {
    toilet: { width: 16, depth: 28, height: 30 },
    vanity: { width: 30, depth: 21, height: 34 },
    shower: { width: 32, depth: 32, height: 78 },
  };

  it("succeeds on the full rung when the room easily fits all three", () => {
    const result = placeFixturesWithFallback(room, reasonable);
    expect(result.feasible).toBe(true);
    if (result.feasible) {
      expect(result.placements.length).toBe(3);
      expect(result.omitted).toEqual([]);
    }
  });

  it("drops vanity and falls back to toilet + shower when vanity can't fit anywhere", () => {
    const footprints = { ...reasonable, vanity: { width: 200, depth: 21, height: 34 } };
    const result = placeFixturesWithFallback(room, footprints);
    expect(result.feasible).toBe(true);
    if (result.feasible) {
      expect(result.placements.map((p) => p.category).sort()).toEqual(["shower", "toilet"]);
      expect(result.omitted).toEqual(["vanity"]);
    }
  });

  it("drops vanity and shower, falls back to toilet-only, when both are impossible", () => {
    const footprints = {
      ...reasonable,
      vanity: { width: 200, depth: 21, height: 34 },
      shower: { width: 200, depth: 32, height: 78 },
    };
    const result = placeFixturesWithFallback(room, footprints);
    expect(result.feasible).toBe(true);
    if (result.feasible) {
      expect(result.placements.map((p) => p.category)).toEqual(["toilet"]);
      expect(result.omitted).toEqual(["vanity", "shower"]);
    }
  });

  it("reports infeasible when even the toilet alone can't fit", () => {
    const footprints: Record<FloorFixtureCategory, Dimensions> = {
      toilet: { width: 200, depth: 28, height: 30 },
      vanity: { width: 200, depth: 21, height: 34 },
      shower: { width: 200, depth: 32, height: 78 },
    };
    const result = placeFixturesWithFallback(room, footprints);
    expect(result.feasible).toBe(false);
  });

  it("resolves the real reported door+window room with all three fixtures, no omissions", () => {
    // Real catalog footprints (toilet 16.5x30, vanity 48x22, shower 60x32) in
    // a real 60x90 room with a door not flush against its wall's start
    // corner and a window on another wall — a genuine reported case. Used to
    // require the topK escalation ladder to find a valid layout at all
    // (solvePlacement missed one at the module's own DEFAULT_TOP_K); now
    // resolves directly at the fast default too, since the door-swing fix
    // (doorSwingRect) stops the search from wasting candidates flush against
    // the door in the first place. The escalation ladder itself stays
    // covered by the synthetic-footprint tests above and below — this one's
    // job is just proving the real reported room actually works end to end.
    const escalationRoom = makeRoom({
      widthIn: 60,
      lengthIn: 90,
      doors: [{ id: "d1", wall: "south", offset: 20, widthIn: 28, swing: "right" }],
      windows: [{ id: "w1", wall: "north", offset: 0, widthIn: 40, sillHeightIn: 48 }],
    });
    const footprints: Record<FloorFixtureCategory, Dimensions> = {
      toilet: { width: 16.5, depth: 30, height: 31 },
      vanity: { width: 48, depth: 22, height: 35 },
      shower: { width: 60, depth: 32, height: 48 },
    };

    expect(solvePlacement(escalationRoom, ["toilet", "vanity", "shower"], footprints, 40)).not.toBeNull();

    const result = placeFixturesWithFallback(escalationRoom, footprints);
    expect(result.feasible).toBe(true);
    if (result.feasible) {
      expect(result.omitted).toEqual([]); // nothing dropped — all three really do fit
      expect(result.placements.map((p) => p.category).sort()).toEqual(["shower", "toilet", "vanity"]);
    }
  });
});
