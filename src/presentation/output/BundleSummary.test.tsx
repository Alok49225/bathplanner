import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

  describe("Change button", () => {
    it("does not render at all when onChangeCategory isn't provided (e.g. the print view)", () => {
      render(<BundleSummary bundle={makeBundle()} catalog={CATALOG} />);
      expect(screen.queryByRole("button", { name: "Change" })).toBeNull();
    });

    it("renders one Change button per present category when onChangeCategory is provided", () => {
      render(<BundleSummary bundle={makeBundle()} catalog={CATALOG} onChangeCategory={() => {}} />);
      expect(screen.getAllByRole("button", { name: "Change" })).toHaveLength(5);
    });

    it("calls onChangeCategory with the clicked row's own category", async () => {
      const onChangeCategory = vi.fn();
      const user = userEvent.setup();
      render(<BundleSummary bundle={makeBundle()} catalog={CATALOG} onChangeCategory={onChangeCategory} />);
      const vanityRow = screen.getByText(/Poplin/).closest("li")!;
      await user.click(within(vanityRow).getByRole("button", { name: "Change" }));
      expect(onChangeCategory).toHaveBeenCalledWith("vanity");
    });

    it("never shows a Change button on an omitted category's row, even when onChangeCategory is provided", () => {
      const bundle: Bundle = {
        id: "bundle-1",
        tier: "balanced",
        items: {
          toilet: makeItem("toilet-1", "toilet"),
          shower: makeItem("shower-1", "shower"),
        },
        totalPriceCents: 150000,
        budgetCents: 300000,
        warnings: [],
      };
      render(<BundleSummary bundle={bundle} catalog={CATALOG} onChangeCategory={() => {}} />);
      // Only toilet and shower are present -> exactly 2 Change buttons, none on the omitted rows.
      expect(screen.getAllByRole("button", { name: "Change" })).toHaveLength(2);
    });
  });

  describe("omitted categories", () => {
    function makeOmittingBundle(omitted: ProductCategory[]): Bundle {
      const items: Partial<Record<ProductCategory, BundleLineItem>> = {};
      (["toilet", "vanity", "faucet", "shower", "lighting"] as ProductCategory[])
        .filter((c) => !omitted.includes(c))
        .forEach((c) => {
          items[c] = makeItem(`${c}-1`, c, `Rationale for ${c}.`);
        });
      return {
        id: "bundle-1",
        tier: "balanced",
        items,
        totalPriceCents: 150000,
        budgetCents: 300000,
        warnings: [],
      };
    }

    it("explains a dropped vanity (and its faucet/lighting cascade) instead of just omitting the rows", () => {
      const bundle = makeOmittingBundle(["vanity", "faucet", "lighting"]);
      render(<BundleSummary bundle={bundle} catalog={CATALOG} />);
      expect(
        screen.getByText("Vanity not included — the room wasn't big enough to fit one after prioritizing the other fixtures.")
      ).toBeInTheDocument();
      expect(
        screen.getByText("Faucet not included — it mounts to the vanity, and there's no vanity in this room's layout.")
      ).toBeInTheDocument();
      expect(
        screen.getByText("Lighting not included — it mounts to the vanity, and there's no vanity in this room's layout.")
      ).toBeInTheDocument();
    });

    it("explains a dropped shower on top of a dropped vanity", () => {
      const bundle = makeOmittingBundle(["vanity", "shower", "faucet", "lighting"]);
      render(<BundleSummary bundle={bundle} catalog={CATALOG} />);
      expect(
        screen.getByText("Shower not included — the room wasn't big enough to fit one after prioritizing the other fixtures.")
      ).toBeInTheDocument();
    });

    it("shows no price or rationale for an omitted row", () => {
      const bundle = makeOmittingBundle(["vanity", "faucet", "lighting"]);
      const { container } = render(<BundleSummary bundle={bundle} catalog={CATALOG} />);
      const omittedRow = container.querySelector(".bundle-summary-item-omitted");
      expect(omittedRow).not.toBeNull();
      expect(omittedRow?.querySelector(".bundle-summary-item-price")).toBeNull();
      expect(omittedRow?.querySelector(".bundle-summary-item-rationale")).toBeNull();
    });

    it("still renders every present category normally alongside the omitted ones", () => {
      const bundle = makeOmittingBundle(["vanity", "faucet", "lighting"]);
      render(<BundleSummary bundle={bundle} catalog={CATALOG} />);
      expect(screen.getByText(/Cimarron · Kohler, white/)).toBeInTheDocument();
      expect(screen.getByText("Rationale for toilet.")).toBeInTheDocument();
    });
  });

  describe("water efficiency", () => {
    it("shows the sustainability score as a rounded percentage", () => {
      render(<BundleSummary bundle={makeBundle({ sustainabilityScore: 0.824 })} catalog={CATALOG} />);
      expect(screen.getByText("Water efficiency:")).toBeInTheDocument();
      expect(screen.getByText("82%")).toBeInTheDocument();
    });

    it("rounds up as well as down", () => {
      render(<BundleSummary bundle={makeBundle({ sustainabilityScore: 0.826 })} catalog={CATALOG} />);
      expect(screen.getByText("83%")).toBeInTheDocument();
    });

    it("handles the 0 and 1 extremes", () => {
      const { rerender } = render(<BundleSummary bundle={makeBundle({ sustainabilityScore: 0 })} catalog={CATALOG} />);
      expect(screen.getByText("0%")).toBeInTheDocument();

      rerender(<BundleSummary bundle={makeBundle({ sustainabilityScore: 1 })} catalog={CATALOG} />);
      expect(screen.getByText("100%")).toBeInTheDocument();
    });

    it("renders nothing at all when sustainabilityScore is absent, instead of showing a bogus 0%", () => {
      const bundle = makeBundle();
      delete bundle.sustainabilityScore;
      const { container } = render(<BundleSummary bundle={bundle} catalog={CATALOG} />);
      expect(container.querySelector(".bundle-summary-sustainability")).toBeNull();
    });
  });
});
