import { describe, it, expect } from "vitest";
import { CatalogDAO } from "./catalog-dao";

describe("CatalogDAO", () => {
  it("reads the generated catalog as a non-empty array", () => {
    const dao = new CatalogDAO();
    const products = dao.readAll();
    expect(Array.isArray(products)).toBe(true);
    expect(products.length).toBeGreaterThan(0);
  });

  it("returns raw rows unmodified between calls", () => {
    const dao = new CatalogDAO();
    const first = dao.readAll();
    const second = dao.readAll();
    expect(first).toEqual(second);
  });

  it("does no domain shaping beyond what build-catalog.mjs already produced", () => {
    const dao = new CatalogDAO();
    const [sample] = dao.readAll();
    expect(sample).toHaveProperty("id");
    expect(sample).toHaveProperty("category");
    expect(sample).toHaveProperty("themeScores");
  });
});
