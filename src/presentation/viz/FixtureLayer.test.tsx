import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FixtureLayer } from "./FixtureLayer";
import { footprintRect, clearanceRect, resolveClearance } from "../../domain/engine/fit-validator";
import type { Product, ProductCategory } from "../../domain/types/product";
import type { RoomDimensions } from "../../domain/types/room";
import type { Bundle, BundleLineItem } from "../../domain/types/bundle";

function makeProduct(id: string, category: ProductCategory, overrides: Partial<Product> = {}): Product {
  return {
    id,
    category,
    name: id,
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

const CATALOG: Product[] = [
  makeProduct("toilet-1", "toilet"),
  makeProduct("vanity-1", "vanity", { dimensions: { width: 30, depth: 21, height: 34 } }),
  makeProduct("faucet-1", "faucet", { dimensions: { width: 2, depth: 6, height: 8 } }),
  makeProduct("shower-1", "shower", { dimensions: { width: 36, depth: 36, height: 48 } }),
  makeProduct("lighting-1", "lighting", { dimensions: { width: 4, depth: 4, height: 8 } }),
];

const ROOM: RoomDimensions = {
  widthIn: 200,
  lengthIn: 200,
  ceilingHeightIn: 96,
  doors: [],
  windows: [],
  plumbing: [
    { id: "t-point", category: "toilet", position: { x: 20, y: 190 }, wall: "south" },
    { id: "v-point", category: "vanity", position: { x: 100, y: 190 }, wall: "south" },
    { id: "s-point", category: "shower", position: { x: 20, y: 20 }, wall: "north" },
  ],
};

function makeItem(productId: string, category: ProductCategory, position: { x: number; y: number }): BundleLineItem {
  return { category, productId, placement: { position } };
}

function makeBundle(overrides: Partial<Record<ProductCategory, BundleLineItem>> = {}): Bundle {
  const vanityPos = ROOM.plumbing.find((p) => p.category === "vanity")!.position;
  return {
    id: "bundle-1",
    tier: "balanced",
    items: {
      toilet: makeItem("toilet-1", "toilet", ROOM.plumbing.find((p) => p.category === "toilet")!.position),
      vanity: makeItem("vanity-1", "vanity", vanityPos),
      faucet: makeItem("faucet-1", "faucet", vanityPos),
      shower: makeItem("shower-1", "shower", ROOM.plumbing.find((p) => p.category === "shower")!.position),
      lighting: makeItem("lighting-1", "lighting", vanityPos),
      ...overrides,
    },
    totalPriceCents: 150000,
    budgetCents: 300000,
    warnings: [],
  };
}

describe("FixtureLayer", () => {
  it("draws the toilet's footprint identically to calling fit-validator's footprintRect directly", () => {
    const bundle = makeBundle();
    render(<FixtureLayer bundle={bundle} catalog={CATALOG} room={ROOM} />);

    const expected = footprintRect(
      CATALOG[0],
      bundle.items.toilet.placement.position,
      ROOM.plumbing.find((p) => p.category === "toilet")!.wall
    );
    const rect = screen.getByTestId("fixture-toilet");
    expect(Number(rect.getAttribute("x"))).toBeCloseTo(Math.min(expected.x1, expected.x2));
    expect(Number(rect.getAttribute("y"))).toBeCloseTo(Math.min(expected.y1, expected.y2));
    expect(Number(rect.getAttribute("width"))).toBeCloseTo(Math.abs(expected.x2 - expected.x1));
    expect(Number(rect.getAttribute("height"))).toBeCloseTo(Math.abs(expected.y2 - expected.y1));
  });

  it("draws faucet and lighting a few inches apart from the vanity's shared position, not on top of each other", () => {
    const bundle = makeBundle();
    render(<FixtureLayer bundle={bundle} catalog={CATALOG} room={ROOM} />);

    const vanityPos = ROOM.plumbing.find((p) => p.category === "vanity")!.position;
    const faucet = screen.getByTestId("fixture-faucet");
    const lighting = screen.getByTestId("fixture-lighting");

    const faucetPoints = faucet.getAttribute("points")!.split(" ")[0].split(",").map(Number);
    const lightingPoints = lighting.getAttribute("points")!.split(" ")[0].split(",").map(Number);

    // marker's first vertex is (x, y-r); the small offset is a drawing-only nudge (a few inches),
    // both still centered on the vanity's y with no vertical shift.
    expect(faucetPoints[0]).not.toBeCloseTo(vanityPos.x);
    expect(lightingPoints[0]).not.toBeCloseTo(vanityPos.x);
    expect(faucetPoints[0]).not.toBeCloseTo(lightingPoints[0]);
    expect(Math.abs(faucetPoints[0] - vanityPos.x)).toBeLessThan(10);
    expect(Math.abs(lightingPoints[0] - vanityPos.x)).toBeLessThan(10);
  });

  it("never changes the underlying placement.position data when offsetting the drawing", () => {
    const bundle = makeBundle();
    const vanityPos = ROOM.plumbing.find((p) => p.category === "vanity")!.position;
    render(<FixtureLayer bundle={bundle} catalog={CATALOG} room={ROOM} />);
    // the offset is purely a rendering concern — the Bundle object itself is untouched
    expect(bundle.items.faucet.placement.position).toEqual(vanityPos);
    expect(bundle.items.lighting.placement.position).toEqual(vanityPos);
  });

  it("renders toilet, vanity, and shower as rects and faucet/lighting as polygon markers", () => {
    const bundle = makeBundle();
    render(<FixtureLayer bundle={bundle} catalog={CATALOG} room={ROOM} />);
    expect(screen.getByTestId("fixture-toilet").tagName.toLowerCase()).toBe("rect");
    expect(screen.getByTestId("fixture-vanity").tagName.toLowerCase()).toBe("rect");
    expect(screen.getByTestId("fixture-shower").tagName.toLowerCase()).toBe("rect");
    expect(screen.getByTestId("fixture-faucet").tagName.toLowerCase()).toBe("polygon");
    expect(screen.getByTestId("fixture-lighting").tagName.toLowerCase()).toBe("polygon");
  });

  it("gives each category its own class, matching FloorPlan's palette naming", () => {
    const bundle = makeBundle();
    render(<FixtureLayer bundle={bundle} catalog={CATALOG} room={ROOM} />);
    expect(screen.getByTestId("fixture-toilet").classList.contains("fixture-toilet")).toBe(true);
    expect(screen.getByTestId("fixture-vanity").classList.contains("fixture-vanity")).toBe(true);
    expect(screen.getByTestId("fixture-shower").classList.contains("fixture-shower")).toBe(true);
  });

  it("skips a fixture whose productId isn't in the given catalog, without crashing", () => {
    const bundle = makeBundle({
      toilet: makeItem("no-such-id", "toilet", { x: 20, y: 190 }),
    });
    expect(() => render(<FixtureLayer bundle={bundle} catalog={CATALOG} room={ROOM} />)).not.toThrow();
    expect(screen.queryByTestId("fixture-toilet")).not.toBeInTheDocument();
    expect(screen.getByTestId("fixture-vanity")).toBeInTheDocument(); // other fixtures still render
  });

  it("labels each fixture with the product name for assistive tech", () => {
    const bundle = makeBundle();
    render(<FixtureLayer bundle={bundle} catalog={CATALOG} room={ROOM} />);
    expect(screen.getByTestId("fixture-toilet").querySelector("title")?.textContent).toBe("toilet-1");
  });

  it("shows no tooltip until a fixture is hovered", () => {
    const bundle = makeBundle();
    const { container } = render(<FixtureLayer bundle={bundle} catalog={CATALOG} room={ROOM} />);
    expect(container.querySelector(".fixture-tooltip")).not.toBeInTheDocument();
  });

  it("shows a name + formatted price tooltip on hovering a floor fixture, and hides it on mouse leave", () => {
    const bundle = makeBundle();
    const { container } = render(<FixtureLayer bundle={bundle} catalog={CATALOG} room={ROOM} />);
    fireEvent.mouseEnter(screen.getByTestId("fixture-toilet"));
    expect(container.querySelector(".fixture-tooltip")?.textContent).toBe("toilet-1 · $300");
    fireEvent.mouseLeave(screen.getByTestId("fixture-toilet"));
    expect(container.querySelector(".fixture-tooltip")).not.toBeInTheDocument();
  });

  it("shows a tooltip for faucet and lighting too, formatted the same way", () => {
    const bundle = makeBundle();
    const { container } = render(<FixtureLayer bundle={bundle} catalog={CATALOG} room={ROOM} />);
    fireEvent.mouseEnter(screen.getByTestId("fixture-faucet"));
    expect(container.querySelector(".fixture-tooltip")?.textContent).toBe("faucet-1 · $300");
  });

  it("formats prices with thousands separators for higher-priced items", () => {
    const bundle = makeBundle();
    const catalogWithExpensiveVanity = [
      ...CATALOG.filter((p) => p.id !== "vanity-1"),
      makeProduct("vanity-1", "vanity", { priceCents: 289000, dimensions: { width: 30, depth: 21, height: 34 } }),
    ];
    const { container } = render(<FixtureLayer bundle={bundle} catalog={catalogWithExpensiveVanity} room={ROOM} />);
    fireEvent.mouseEnter(screen.getByTestId("fixture-vanity"));
    expect(container.querySelector(".fixture-tooltip")?.textContent).toBe("vanity-1 · $2,890");
  });

  it("switches to the newly hovered fixture's tooltip rather than showing both", () => {
    const bundle = makeBundle();
    const { container } = render(<FixtureLayer bundle={bundle} catalog={CATALOG} room={ROOM} />);
    fireEvent.mouseEnter(screen.getByTestId("fixture-toilet"));
    fireEvent.mouseEnter(screen.getByTestId("fixture-vanity"));
    const tooltips = container.querySelectorAll(".fixture-tooltip");
    expect(tooltips).toHaveLength(1);
    expect(tooltips[0].textContent).toBe("vanity-1 · $300");
  });

  it("renders a legend with all five categories, regardless of hover state", () => {
    const bundle = makeBundle();
    render(<FixtureLayer bundle={bundle} catalog={CATALOG} room={ROOM} />);
    ["Toilet", "Vanity", "Faucet", "Shower", "Lighting"].forEach((label) => {
      expect(screen.getByText(label)).toBeInTheDocument();
    });
  });

  it("gives faucet and lighting a distinct diamond-shaped legend swatch from the rect-shaped floor-fixture swatches", () => {
    const bundle = makeBundle();
    const { container } = render(<FixtureLayer bundle={bundle} catalog={CATALOG} room={ROOM} />);
    const diamondSwatches = container.querySelectorAll(".fixture-legend-swatch-diamond");
    expect(diamondSwatches).toHaveLength(2); // faucet + lighting only
  });

  describe("clearance overlay", () => {
    // Same shape as fit-validator.test.ts's own proven "close but no overlap"
    // case: footprints don't intersect, but their clearance zones do.
    const TIGHT_ROOM: RoomDimensions = {
      widthIn: 80,
      lengthIn: 200,
      ceilingHeightIn: 96,
      doors: [],
      windows: [],
      plumbing: [
        { id: "t-point", category: "toilet", position: { x: 5, y: 190 }, wall: "south" },
        { id: "v-point", category: "vanity", position: { x: 22, y: 190 }, wall: "south" },
        { id: "s-point", category: "shower", position: { x: 20, y: 20 }, wall: "north" },
      ],
    };
    const TIGHT_CATALOG: Product[] = [
      makeProduct("toilet-1", "toilet"),
      makeProduct("vanity-1", "vanity", { dimensions: { width: 24, depth: 21, height: 34 } }),
      makeProduct("faucet-1", "faucet", { dimensions: { width: 2, depth: 6, height: 8 } }),
      makeProduct("shower-1", "shower", { dimensions: { width: 36, depth: 36, height: 48 } }),
      makeProduct("lighting-1", "lighting", { dimensions: { width: 4, depth: 4, height: 8 } }),
    ];

    function makeTightBundle(): Bundle {
      const vanityPos = TIGHT_ROOM.plumbing.find((p) => p.category === "vanity")!.position;
      return {
        id: "bundle-tight",
        tier: "balanced",
        items: {
          toilet: makeItem("toilet-1", "toilet", TIGHT_ROOM.plumbing.find((p) => p.category === "toilet")!.position),
          vanity: makeItem("vanity-1", "vanity", vanityPos),
          faucet: makeItem("faucet-1", "faucet", vanityPos),
          shower: makeItem("shower-1", "shower", TIGHT_ROOM.plumbing.find((p) => p.category === "shower")!.position),
          lighting: makeItem("lighting-1", "lighting", vanityPos),
        },
        totalPriceCents: 150000,
        budgetCents: 300000,
        warnings: [],
      };
    }

    it("shows no clearance overlay anywhere in a well-spaced room", () => {
      const bundle = makeBundle();
      const { container } = render(<FixtureLayer bundle={bundle} catalog={CATALOG} room={ROOM} />);
      expect(container.querySelectorAll(".fixture-clearance-overlay")).toHaveLength(0);
    });

    it("shows the overlay only on the categories the engine actually flagged as tight", () => {
      const { container } = render(
        <FixtureLayer bundle={makeTightBundle()} catalog={TIGHT_CATALOG} room={TIGHT_ROOM} />
      );
      const flagged = container.querySelectorAll(".fixture-clearance-overlay");
      expect(flagged.length).toBeGreaterThan(0);
      // shower is far from the toilet/vanity cluster — never flagged
      expect(container.querySelector('[data-testid="clearance-shower"]')).not.toBeInTheDocument();
    });

    it("draws the overlay using fit-validator's own clearanceRect, not a re-derived rectangle", () => {
      const bundle = makeTightBundle();
      const { container } = render(<FixtureLayer bundle={bundle} catalog={TIGHT_CATALOG} room={TIGHT_ROOM} />);
      const toiletProduct = TIGHT_CATALOG.find((p) => p.id === "toilet-1")!;
      const toiletPoint = TIGHT_ROOM.plumbing.find((p) => p.category === "toilet")!;
      const footprint = footprintRect(toiletProduct, bundle.items.toilet.placement.position, toiletPoint.wall);
      const expected = clearanceRect(footprint, toiletPoint.wall, resolveClearance(toiletProduct, "toilet"));

      const overlay = container.querySelector('[data-testid="clearance-toilet"]');
      expect(overlay).not.toBeNull();
      if (overlay) {
        expect(Number(overlay.getAttribute("x"))).toBeCloseTo(Math.min(expected.x1, expected.x2));
        expect(Number(overlay.getAttribute("y"))).toBeCloseTo(Math.min(expected.y1, expected.y2));
      }
    });
  });
});
