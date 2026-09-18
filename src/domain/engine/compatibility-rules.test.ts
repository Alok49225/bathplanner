import { describe, it, expect } from "vitest";
import { filterEligibleProducts, checkFinishCoordination } from "./compatibility-rules";
import type { Product, ProductCategory, Finish, InstallComplexity } from "../types/product";
import type { Constraint, Room } from "../types/room";

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: "p1",
    category: "toilet",
    name: "Test Toilet",
    brand: "Kohler",
    priceCents: 30000,
    finish: "white",
    dimensions: { width: 15, depth: 28, height: 30 },
    installComplexity: "standard",
    styleTags: [],
    themeScores: { "minimalist-modern": 0.5, "classic-luxury": 0.5, "japanese-zen": 0.5 },
    finishFamily: "test",
    ...overrides,
  };
}

function fullCatalog(overrides: Partial<Record<ProductCategory, Partial<Product>[]>> = {}): Product[] {
  const base: Record<ProductCategory, Partial<Product>[]> = {
    toilet: [{ id: "t1" }],
    vanity: [{ id: "v1" }],
    faucet: [{ id: "f1" }],
    shower: [{ id: "s1" }],
    lighting: [{ id: "l1" }],
    ...overrides,
  };
  const products: Product[] = [];
  (Object.keys(base) as ProductCategory[]).forEach((category) => {
    base[category].forEach((p) => products.push(makeProduct({ category, ...p })));
  });
  return products;
}

// Generous and well-separated, so physical fit is never the reason a test
// fails unless it's specifically testing the fit pre-filter.
function makeRoom(overrides: Partial<Room> = {}): Room {
  return {
    widthIn: 200,
    lengthIn: 200,
    ceilingHeightIn: 96,
    doors: [],
    windows: [],
    plumbing: [
      { id: "toilet-point", category: "toilet", position: { x: 20, y: 190 }, wall: "south" },
      { id: "vanity-point", category: "vanity", position: { x: 100, y: 190 }, wall: "south" },
      { id: "shower-point", category: "shower", position: { x: 20, y: 20 }, wall: "north" },
    ],
    accessibility: {},
    constraints: [],
    ...overrides,
  };
}

describe("filterEligibleProducts", () => {
  it("keeps every product when there are no constraints", () => {
    const catalog = fullCatalog();
    const { eligible, errors } = filterEligibleProducts(catalog, makeRoom());
    expect(errors).toEqual([]);
    expect(eligible.toilet).toHaveLength(1);
  });

  it("removes products carrying an avoided tag", () => {
    const catalog = fullCatalog({
      shower: [{ id: "s-curbless", styleTags: ["curbless"] }, { id: "s-standard", styleTags: [] }],
    });
    const constraints: Constraint[] = [
      { id: "c1", strength: "hard", description: "No curbless", rule: { type: "avoid-tag", tag: "curbless" } },
    ];
    const { eligible } = filterEligibleProducts(catalog, makeRoom({ constraints }));
    expect(eligible.shower.map((p) => p.id)).toEqual(["s-standard"]);
  });

  it("removes products above the max install complexity", () => {
    const catalog = fullCatalog({
      shower: [
        { id: "s-drop", installComplexity: "drop-in" as InstallComplexity },
        { id: "s-specialist", installComplexity: "specialist" as InstallComplexity },
      ],
    });
    const constraints: Constraint[] = [
      { id: "c1", strength: "hard", description: "Keep it simple", rule: { type: "max-install-complexity", level: "drop-in" } },
    ];
    const { eligible } = filterEligibleProducts(catalog, makeRoom({ constraints }));
    expect(eligible.shower.map((p) => p.id)).toEqual(["s-drop"]);
  });

  it("uses the most restrictive limit when multiple max-install-complexity constraints are given", () => {
    const catalog = fullCatalog({
      vanity: [
        { id: "v-drop", installComplexity: "drop-in" as InstallComplexity },
        { id: "v-standard", installComplexity: "standard" as InstallComplexity },
      ],
    });
    const constraints: Constraint[] = [
      { id: "c1", strength: "hard", description: "a", rule: { type: "max-install-complexity", level: "standard" } },
      { id: "c2", strength: "hard", description: "b", rule: { type: "max-install-complexity", level: "drop-in" } },
    ];
    const { eligible } = filterEligibleProducts(catalog, makeRoom({ constraints }));
    expect(eligible.vanity.map((p) => p.id)).toEqual(["v-drop"]);
  });

  it("reports an error when a category has zero eligible products left", () => {
    const catalog = fullCatalog({ lighting: [{ id: "l1", styleTags: ["ornate"] }] });
    const constraints: Constraint[] = [
      { id: "c1", strength: "hard", description: "No ornate", rule: { type: "avoid-tag", tag: "ornate" } },
    ];
    const { eligible, errors } = filterEligibleProducts(catalog, makeRoom({ constraints }));
    expect(eligible.lighting).toEqual([]);
    expect(errors).toEqual([
      {
        severity: "error",
        code: "category-unavailable",
        message: "No lighting products remain after applying the room's constraints.",
        categories: ["lighting"],
      },
    ]);
  });

  it("leaves keep-fixture and must-include-tag constraints unconsumed (not a catalog filter)", () => {
    const catalog = fullCatalog();
    const constraints: Constraint[] = [
      { id: "c1", strength: "hard", description: "Keep it", rule: { type: "keep-fixture", category: "vanity" } },
      { id: "c2", strength: "soft", description: "Want a tub", rule: { type: "must-include-tag", tag: "soaking-tub" } },
    ];
    const { eligible, errors } = filterEligibleProducts(catalog, makeRoom({ constraints }));
    expect(errors).toEqual([]);
    expect(eligible.vanity).toHaveLength(1);
  });

  it("pre-filters a floor fixture that physically can't fit the room, even with no constraints", () => {
    const catalog = fullCatalog({
      vanity: [
        { id: "v-huge", dimensions: { width: 500, depth: 21, height: 34 } },
        { id: "v-normal", dimensions: { width: 30, depth: 21, height: 34 } },
      ],
    });
    const { eligible, errors } = filterEligibleProducts(catalog, makeRoom());
    expect(eligible.vanity.map((p) => p.id)).toEqual(["v-normal"]);
    expect(errors).toEqual([]);
  });

  it("errors with category-unavailable when every option in a category is too big for the room", () => {
    const catalog = fullCatalog({
      shower: [{ id: "s-huge", dimensions: { width: 500, depth: 500, height: 48 } }],
    });
    const { eligible, errors } = filterEligibleProducts(catalog, makeRoom());
    expect(eligible.shower).toEqual([]);
    expect(errors).toContainEqual(expect.objectContaining({ code: "category-unavailable", categories: ["shower"] }));
  });

  it("never physical-fit-filters faucet or lighting — they have no plumbing point to check against", () => {
    const catalog = fullCatalog({
      faucet: [{ id: "f-huge", dimensions: { width: 500, depth: 500, height: 500 } }],
    });
    const { eligible } = filterEligibleProducts(catalog, makeRoom());
    expect(eligible.faucet.map((p) => p.id)).toEqual(["f-huge"]);
  });
});

describe("checkFinishCoordination", () => {
  const PRODUCT_CATEGORY_CYCLE: ProductCategory[] = ["toilet", "vanity", "faucet", "shower", "lighting"];
  function withFinishes(finishes: Finish[]): Product[] {
    return finishes.map((finish, i) =>
      makeProduct({ id: `p${i}`, category: PRODUCT_CATEGORY_CYCLE[i], finish })
    );
  }

  it("passes when only neutral finishes are used", () => {
    expect(checkFinishCoordination(withFinishes(["white", "matte-black", "white"]))).toEqual([]);
  });

  it("passes with exactly two distinct non-neutral finishes", () => {
    expect(checkFinishCoordination(withFinishes(["chrome", "brushed-gold", "white"]))).toEqual([]);
  });

  it("neutrals don't count toward the 2-finish limit", () => {
    const items = withFinishes(["chrome", "brushed-gold", "matte-black", "white", "chrome"]);
    expect(checkFinishCoordination(items)).toEqual([]);
  });

  it("warns, but does not reject, when 3+ non-neutral finishes appear", () => {
    const items = withFinishes(["chrome", "brushed-gold", "oil-rubbed-bronze"]);
    const issues = checkFinishCoordination(items);
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe("warning");
    expect(issues[0].code).toBe("finish-mismatch");
    expect(issues[0].message).toContain("3 finishes");
  });
});
