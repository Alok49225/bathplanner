import { describe, it, expect } from "vitest";
import { validateFit } from "./fit-validator";
import type { FloorFixturePlacement, FloorFixtureCategory } from "./fit-validator";
import type { Product } from "../types/product";
import type { Room } from "../types/room";

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: "p1",
    category: "toilet",
    name: "Test Toilet",
    brand: "Kohler",
    priceCents: 30000,
    finish: "white",
    dimensions: { width: 16, depth: 28, height: 30 },
    installComplexity: "standard",
    styleTags: [],
    themeScores: { "minimalist-modern": 0.5, "classic-luxury": 0.5, "japanese-zen": 0.5 },
    finishFamily: "test",
    ...overrides,
  };
}

function makeRoom(overrides: Partial<Room> = {}): Room {
  return {
    widthIn: 60,
    lengthIn: 96,
    ceilingHeightIn: 96,
    doors: [],
    windows: [],
    plumbing: [
      { id: "toilet-rough-in", category: "toilet", position: { x: 20, y: 90 }, wall: "south" },
    ],
    accessibility: {},
    constraints: [],
    ...overrides,
  };
}

describe("validateFit", () => {
  it("passes a single well-placed fixture with room to spare", () => {
    const room = makeRoom();
    const placements: FloorFixturePlacement[] = [
      { category: "toilet", product: makeProduct(), plumbingPointId: "toilet-rough-in" },
    ];
    expect(validateFit(placements, room)).toEqual([]);
  });

  it("errors when a placement references a plumbing point that doesn't exist", () => {
    const room = makeRoom();
    const placements: FloorFixturePlacement[] = [
      { category: "toilet", product: makeProduct(), plumbingPointId: "missing-point" },
    ];
    const issues = validateFit(placements, room);
    expect(issues).toContainEqual(
      expect.objectContaining({ severity: "error", code: "no-plumbing-point" })
    );
  });

  it("errors when the plumbing point's category doesn't match the placement's category", () => {
    const room = makeRoom({
      plumbing: [{ id: "shared-id", category: "vanity", position: { x: 10, y: 10 }, wall: "north" }],
    });
    const placements: FloorFixturePlacement[] = [
      { category: "toilet", product: makeProduct(), plumbingPointId: "shared-id" },
    ];
    const issues = validateFit(placements, room);
    expect(issues.some((i) => i.code === "no-plumbing-point")).toBe(true);
  });

  it("errors when the footprint extends past the room's bounds", () => {
    const room = makeRoom({
      widthIn: 20,
      plumbing: [{ id: "toilet-rough-in", category: "toilet", position: { x: 10, y: 90 }, wall: "south" }],
    });
    // width 16 at x=10 -> extends to x=26, past a 20in-wide room
    const placements: FloorFixturePlacement[] = [
      { category: "toilet", product: makeProduct(), plumbingPointId: "toilet-rough-in" },
    ];
    const issues = validateFit(placements, room);
    expect(issues).toContainEqual(expect.objectContaining({ severity: "error", code: "out-of-bounds" }));
  });

  it("warns, doesn't error, when a lone fixture's clearance runs past the opposite wall", () => {
    const room = makeRoom({
      lengthIn: 40, // south wall at y=40; toilet at y=35 with depth 28 -> front clearance won't fit
      plumbing: [{ id: "toilet-rough-in", category: "toilet", position: { x: 10, y: 35 }, wall: "south" }],
    });
    const placements: FloorFixturePlacement[] = [
      { category: "toilet", product: makeProduct(), plumbingPointId: "toilet-rough-in" },
    ];
    const issues = validateFit(placements, room);
    expect(issues).toEqual([
      expect.objectContaining({ severity: "warning", code: "insufficient-clearance" }),
    ]);
  });

  it("errors when two fixtures' footprints physically overlap", () => {
    const room = makeRoom({
      plumbing: [
        { id: "toilet-rough-in", category: "toilet", position: { x: 10, y: 90 }, wall: "south" },
        { id: "vanity-supply", category: "vanity", position: { x: 12, y: 90 }, wall: "south" },
      ],
    });
    const placements: FloorFixturePlacement[] = [
      { category: "toilet", product: makeProduct({ category: "toilet" }), plumbingPointId: "toilet-rough-in" },
      {
        category: "vanity",
        product: makeProduct({ category: "vanity", dimensions: { width: 30, depth: 21, height: 34 } }),
        plumbingPointId: "vanity-supply",
      },
    ];
    const issues = validateFit(placements, room);
    expect(issues).toContainEqual(expect.objectContaining({ severity: "error", code: "overlaps-fixture" }));
  });

  it("warns, not errors, when fixtures are close but their footprints don't overlap", () => {
    const room = makeRoom({
      widthIn: 80,
      plumbing: [
        { id: "toilet-rough-in", category: "toilet", position: { x: 5, y: 90 }, wall: "south" },
        { id: "vanity-supply", category: "vanity", position: { x: 22, y: 90 }, wall: "south" },
      ],
    });
    const placements: FloorFixturePlacement[] = [
      { category: "toilet", product: makeProduct({ category: "toilet" }), plumbingPointId: "toilet-rough-in" },
      {
        category: "vanity",
        product: makeProduct({ category: "vanity", dimensions: { width: 24, depth: 21, height: 34 } }),
        plumbingPointId: "vanity-supply",
      },
    ];
    const issues = validateFit(placements, room);
    expect(issues.some((i) => i.code === "overlaps-fixture")).toBe(false);
    expect(issues).toContainEqual(expect.objectContaining({ severity: "warning", code: "insufficient-clearance" }));
  });

  it("orients the footprint correctly for each of the four walls", () => {
    (["north", "south", "east", "west"] as const).forEach((wall) => {
      const room = makeRoom({
        widthIn: 100,
        lengthIn: 100,
        plumbing: [{ id: "toilet-rough-in", category: "toilet", position: { x: 50, y: 50 }, wall }],
      });
      const placements: FloorFixturePlacement[] = [
        { category: "toilet", product: makeProduct(), plumbingPointId: "toilet-rough-in" },
      ];
      expect(validateFit(placements, room)).toEqual([]);
    });
  });

  it("warns when a fixture's footprint reaches a window's span on the same wall", () => {
    const room = makeRoom({
      windows: [{ id: "w1", wall: "north", offset: 10, widthIn: 20, sillHeightIn: 36 }], // spans x:[10,30)
      plumbing: [{ id: "toilet-rough-in", category: "toilet", position: { x: 15, y: 0 }, wall: "north" }],
    });
    const placements: FloorFixturePlacement[] = [
      { category: "toilet", product: makeProduct(), plumbingPointId: "toilet-rough-in" },
    ];
    const issues = validateFit(placements, room);
    expect(issues).toContainEqual(expect.objectContaining({ severity: "warning", code: "overlaps-window" }));
  });

  it("doesn't warn about a window nowhere near the fixture", () => {
    const room = makeRoom({
      windows: [{ id: "w1", wall: "north", offset: 45, widthIn: 10, sillHeightIn: 36 }],
      plumbing: [{ id: "toilet-rough-in", category: "toilet", position: { x: 5, y: 0 }, wall: "north" }],
    });
    const placements: FloorFixturePlacement[] = [
      { category: "toilet", product: makeProduct(), plumbingPointId: "toilet-rough-in" },
    ];
    const issues = validateFit(placements, room);
    expect(issues.some((i) => i.code === "overlaps-window")).toBe(false);
  });

  it("only ever reports the three floor-fixture categories", () => {
    const room = makeRoom();
    const placements: FloorFixturePlacement[] = [
      { category: "toilet", product: makeProduct(), plumbingPointId: "missing" },
    ];
    const issues = validateFit(placements, room);
    const categories: FloorFixtureCategory[] = ["toilet", "vanity", "shower"];
    issues.forEach((issue) => expect(categories).toContain(issue.category));
  });

  describe("messages stay human-readable — no leaked internal IDs", () => {
    // These messages flow straight into Bundle.warnings and get shown
    // verbatim in BundleSummary/chat — a raw plumbing-point UUID in there
    // is meaningless noise to a user, not a helpful detail.
    it("doesn't include the plumbing point id in the no-plumbing-point message", () => {
      const room = makeRoom();
      const placements: FloorFixturePlacement[] = [
        { category: "toilet", product: makeProduct(), plumbingPointId: "plumbing-abc123-should-not-appear" },
      ];
      const [issue] = validateFit(placements, room);
      expect(issue.message).toBe("No toilet rough-in found for this bundle.");
      expect(issue.message).not.toContain("plumbing-abc123-should-not-appear");
    });

    it("doesn't include the plumbing point id in the out-of-bounds message", () => {
      const room = makeRoom({
        widthIn: 20,
        plumbing: [{ id: "plumbing-should-not-appear", category: "toilet", position: { x: 10, y: 90 }, wall: "south" }],
      });
      const placements: FloorFixturePlacement[] = [
        { category: "toilet", product: makeProduct(), plumbingPointId: "plumbing-should-not-appear" },
      ];
      const [issue] = validateFit(placements, room);
      expect(issue.message).toBe("toilet doesn't fit within the room's footprint.");
      expect(issue.message).not.toContain("plumbing-should-not-appear");
    });

    it("doesn't include either plumbing point id in the overlaps-fixture message", () => {
      const room = makeRoom({
        plumbing: [
          { id: "plumbing-toilet-should-not-appear", category: "toilet", position: { x: 10, y: 90 }, wall: "south" },
          { id: "plumbing-vanity-should-not-appear", category: "vanity", position: { x: 12, y: 90 }, wall: "south" },
        ],
      });
      const placements: FloorFixturePlacement[] = [
        { category: "toilet", product: makeProduct({ category: "toilet" }), plumbingPointId: "plumbing-toilet-should-not-appear" },
        {
          category: "vanity",
          product: makeProduct({ category: "vanity", dimensions: { width: 30, depth: 21, height: 34 } }),
          plumbingPointId: "plumbing-vanity-should-not-appear",
        },
      ];
      const issues = validateFit(placements, room);
      const overlapIssue = issues.find((i) => i.code === "overlaps-fixture")!;
      expect(overlapIssue.message).toBe("toilet physically overlaps vanity.");
      expect(overlapIssue.message).not.toContain("plumbing-");
    });

    it("doesn't include the plumbing point id in the insufficient-clearance message", () => {
      const room = makeRoom({
        lengthIn: 40,
        plumbing: [{ id: "plumbing-should-not-appear", category: "toilet", position: { x: 10, y: 35 }, wall: "south" }],
      });
      const placements: FloorFixturePlacement[] = [
        { category: "toilet", product: makeProduct(), plumbingPointId: "plumbing-should-not-appear" },
      ];
      const [issue] = validateFit(placements, room);
      expect(issue.message).toBe("toilet has less than the recommended 21in front clearance.");
      expect(issue.message).not.toContain("plumbing-should-not-appear");
    });

    it("doesn't include the plumbing point id in the overlaps-window message", () => {
      const room = makeRoom({
        windows: [{ id: "w1", wall: "north", offset: 10, widthIn: 20, sillHeightIn: 36 }],
        plumbing: [{ id: "plumbing-should-not-appear", category: "toilet", position: { x: 15, y: 0 }, wall: "north" }],
      });
      const placements: FloorFixturePlacement[] = [
        { category: "toilet", product: makeProduct(), plumbingPointId: "plumbing-should-not-appear" },
      ];
      const issues = validateFit(placements, room);
      const windowIssue = issues.find((i) => i.code === "overlaps-window")!;
      expect(windowIssue.message).toBe("toilet is placed right at a window.");
      expect(windowIssue.message).not.toContain("plumbing-should-not-appear");
    });
  });
});
