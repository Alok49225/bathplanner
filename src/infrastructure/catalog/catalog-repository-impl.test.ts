import { describe, it, expect } from "vitest";
import { StaticCatalogRepository } from "./catalog-repository-impl";
import type { CatalogDAO } from "./catalog-dao";
import type { Product } from "../../domain/types/product";

function fakeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: "fake-1",
    category: "toilet",
    name: "Fake Toilet",
    brand: "Test",
    priceCents: 10000,
    finish: "white",
    dimensions: { width: 1, depth: 1, height: 1 },
    installComplexity: "standard",
    styleTags: [],
    themeScores: { "minimalist-modern": 0.5, "classic-luxury": 0.5, "japanese-zen": 0.5 },
    finishFamily: "test",
    ...overrides,
  };
}

function fakeDao(products: Product[]): CatalogDAO {
  return { readAll: () => products } as CatalogDAO;
}

describe("StaticCatalogRepository", () => {
  it("implements CatalogRepository against an injected DAO, not the real file", async () => {
    const products = [fakeProduct({ id: "a" }), fakeProduct({ id: "b" })];
    const repo = new StaticCatalogRepository(fakeDao(products));
    await expect(repo.getAll()).resolves.toEqual(products);
  });

  it("passes DAO rows through unchanged — no mapping happens yet", async () => {
    const products = [fakeProduct({ id: "a", priceCents: 42900 })];
    const repo = new StaticCatalogRepository(fakeDao(products));
    const [result] = await repo.getAll();
    expect(result).toBe(products[0]);
  });

  it("finds a product by id", async () => {
    const products = [fakeProduct({ id: "a" }), fakeProduct({ id: "b" })];
    const repo = new StaticCatalogRepository(fakeDao(products));
    await expect(repo.getById("b")).resolves.toEqual(products[1]);
  });

  it("resolves undefined, not throws, for an unknown id", async () => {
    const repo = new StaticCatalogRepository(fakeDao([fakeProduct({ id: "a" })]));
    await expect(repo.getById("missing")).resolves.toBeUndefined();
  });

  it("returns promises, matching the interface even though resolution is instant", () => {
    const repo = new StaticCatalogRepository(fakeDao([]));
    expect(repo.getAll()).toBeInstanceOf(Promise);
    expect(repo.getById("x")).toBeInstanceOf(Promise);
  });
});
