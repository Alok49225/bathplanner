import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ShareableExport } from "./ShareableExport";
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
  makeProduct("toilet-1", "toilet", { name: "Cimarron", priceCents: 35000 }),
  makeProduct("vanity-1", "vanity", { name: "Poplin", priceCents: 82000, dimensions: { width: 30, depth: 21, height: 34 } }),
  makeProduct("faucet-1", "faucet", { name: "Purist", priceCents: 21000, dimensions: { width: 2, depth: 6, height: 8 } }),
  makeProduct("shower-1", "shower", { name: "Elmbrook", priceCents: 105000, dimensions: { width: 36, depth: 36, height: 48 } }),
  makeProduct("lighting-1", "lighting", { name: "Verdera", priceCents: 15000, dimensions: { width: 4, depth: 4, height: 8 } }),
];

const ROOM: RoomDimensions = {
  widthIn: 60,
  lengthIn: 96,
  ceilingHeightIn: 96,
  doors: [],
  windows: [],
  plumbing: [
    { id: "t-point", category: "toilet", position: { x: 10, y: 90 }, wall: "south" },
    { id: "v-point", category: "vanity", position: { x: 40, y: 90 }, wall: "south" },
    { id: "s-point", category: "shower", position: { x: 10, y: 10 }, wall: "north" },
  ],
};

function makeItem(productId: string, category: ProductCategory, position: { x: number; y: number }): BundleLineItem {
  return { category, productId, placement: { position } };
}

const vanityPos = ROOM.plumbing.find((p) => p.category === "vanity")!.position;
const BUNDLE: Bundle = {
  id: "bundle-1",
  tier: "balanced",
  items: {
    toilet: makeItem("toilet-1", "toilet", ROOM.plumbing.find((p) => p.category === "toilet")!.position),
    vanity: makeItem("vanity-1", "vanity", vanityPos),
    faucet: makeItem("faucet-1", "faucet", vanityPos),
    shower: makeItem("shower-1", "shower", ROOM.plumbing.find((p) => p.category === "shower")!.position),
    lighting: makeItem("lighting-1", "lighting", vanityPos),
  },
  totalPriceCents: 258000,
  budgetCents: 300000,
  warnings: [],
};

describe("ShareableExport", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls window.print() when the print button is clicked", async () => {
    const printSpy = vi.spyOn(window, "print").mockImplementation(() => {});
    const user = userEvent.setup();
    render(<ShareableExport bundle={BUNDLE} catalog={CATALOG} room={ROOM} />);
    await user.click(screen.getByRole("button", { name: "Print / Save as PDF" }));
    expect(printSpy).toHaveBeenCalledOnce();
  });

  it("shows a header with the tier, room dimensions, and budget", () => {
    const { container } = render(<ShareableExport bundle={BUNDLE} catalog={CATALOG} room={ROOM} />);
    expect(screen.getByText(/Balanced bundle/)).toBeInTheDocument();
    const meta = container.querySelector(".shareable-export-meta")!;
    expect(meta.textContent).toContain("60in × 96in");
    expect(meta.textContent).toContain("$3,000");
  });

  it("composes the real floor plan, fixtures, and bundle summary for the given bundle", () => {
    const { container } = render(<ShareableExport bundle={BUNDLE} catalog={CATALOG} room={ROOM} />);
    expect(container.querySelector(".floor-plan")).toBeInTheDocument();
    expect(screen.getByTestId("fixture-toilet")).toBeInTheDocument();
    expect(screen.getByText(/Cimarron · Kohler, white/)).toBeInTheDocument();
    expect(screen.getByText(/Total:/)).toBeInTheDocument();
  });
});
