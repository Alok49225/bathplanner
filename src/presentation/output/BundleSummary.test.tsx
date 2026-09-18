import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BundleSummary } from "./BundleSummary";
import type { Bundle, BundleLineItem } from "../../domain/types/bundle";
import type { Product, ProductCategory } from "../../domain/types/product";

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
  makeProduct("toilet-1", "toilet", { name: "Cimarron", priceCents: 35000, finish: "white" }),
  makeProduct("vanity-1", "vanity", { name: "Poplin", brand: "Kohler", priceCents: 82000, finish: "matte-black" }),
  makeProduct("faucet-1", "faucet", { name: "Purist", priceCents: 21000 }),
  makeProduct("shower-1", "shower", { name: "Elmbrook", priceCents: 105000 }),
  makeProduct("lighting-1", "lighting", { name: "Verdera", priceCents: 15000 }),
];

function makeItem(productId: string, category: ProductCategory, rationale?: string): BundleLineItem {
  return { category, productId, placement: { position: { x: 0, y: 0 } }, rationale };
}

function makeBundle(overrides: Partial<Bundle> = {}, itemOverrides: Partial<Record<ProductCategory, BundleLineItem>> = {}): Bundle {
  return {
    id: "bundle-1",
    tier: "balanced",
    items: {
      toilet: itemOverrides.toilet ?? makeItem("toilet-1", "toilet", "The best water efficiency in this category."),
      vanity: itemOverrides.vanity ?? makeItem("vanity-1", "vanity", "A strong match for the Japanese Zen theme."),
      faucet: itemOverrides.faucet ?? makeItem("faucet-1", "faucet", "The most affordable option that still coordinates."),
      shower: itemOverrides.shower ?? makeItem("shower-1", "shower", "Chosen for its water-saving flow rate."),
      lighting: itemOverrides.lighting ?? makeItem("lighting-1", "lighting", "Matches the vanity's finish family."),
      ...itemOverrides,
    },
    totalPriceCents: 258000,
    budgetCents: 300000,
    warnings: [],
    ...overrides,
  };
}

describe("BundleSummary", () => {
  it("renders every category's product name, brand, finish, price, and rationale, resolved from the catalog", () => {
    render(<BundleSummary bundle={makeBundle()} catalog={CATALOG} />);
    expect(screen.getByText(/Cimarron · Kohler, white/)).toBeInTheDocument();
    expect(screen.getByText("$350")).toBeInTheDocument();
    expect(screen.getByText("The best water efficiency in this category.")).toBeInTheDocument();

    expect(screen.getByText(/Poplin · Kohler, matte-black/)).toBeInTheDocument();
    expect(screen.getByText("$820")).toBeInTheDocument();
  });

  it("labels each line with its category so items aren't distinguishable only by product name", () => {
    render(<BundleSummary bundle={makeBundle()} catalog={CATALOG} />);
    expect(screen.getByText("Toilet")).toBeInTheDocument();
    expect(screen.getByText("Vanity")).toBeInTheDocument();
    expect(screen.getByText("Faucet")).toBeInTheDocument();
    expect(screen.getByText("Shower")).toBeInTheDocument();
    expect(screen.getByText("Lighting")).toBeInTheDocument();
  });

  it("shows the total against the budget and the remaining headroom when under budget", () => {
    render(<BundleSummary bundle={makeBundle({ totalPriceCents: 258000, budgetCents: 300000 })} catalog={CATALOG} />);
    expect(screen.getByText(/Total:/)).toBeInTheDocument();
    expect(screen.getByText("$2,580")).toBeInTheDocument();
    expect(screen.getByText(/of \$3,000 budget/)).toBeInTheDocument();
    expect(screen.getByText("$420 remaining")).toBeInTheDocument();
  });

  it("shows an 'over' figure instead of 'remaining' when the total exceeds the budget", () => {
    render(<BundleSummary bundle={makeBundle({ totalPriceCents: 320000, budgetCents: 300000 })} catalog={CATALOG} />);
    expect(screen.getByText("$200 over")).toBeInTheDocument();
  });

  it("shows a warnings section only when the bundle actually has warnings", () => {
    const { container, rerender } = render(<BundleSummary bundle={makeBundle({ warnings: [] })} catalog={CATALOG} />);
    expect(container.querySelector(".bundle-summary-warnings")).toBeNull();

    rerender(<BundleSummary bundle={makeBundle({ warnings: ["Tight clearance around the toilet."] })} catalog={CATALOG} />);
    expect(container.querySelector(".bundle-summary-warnings")).not.toBeNull();
    expect(screen.getByText("Tight clearance around the toilet.")).toBeInTheDocument();
  });

  it("falls back gracefully instead of crashing or showing literal 'undefined' when rationale is missing", () => {
    const bundle = makeBundle({}, { toilet: makeItem("toilet-1", "toilet", undefined) });
    render(<BundleSummary bundle={bundle} catalog={CATALOG} />);
    expect(screen.queryByText("undefined")).toBeNull();
  });

  it("falls back gracefully instead of crashing when a line item's product isn't in the given catalog", () => {
    const bundle = makeBundle({}, { toilet: makeItem("missing-id", "toilet", "Some rationale.") });
    render(<BundleSummary bundle={bundle} catalog={CATALOG} />);
    expect(screen.getByText("missing-id")).toBeInTheDocument();
  });
});
