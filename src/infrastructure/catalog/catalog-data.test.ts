import { describe, it, expect } from "vitest";
import catalogData from "./generated/catalog.json";
import type { Product, ProductCategory } from "../../domain/types/product";
import { THEMES } from "../../domain/types/product";

const CATEGORIES: ProductCategory[] = ["toilet", "vanity", "faucet", "shower", "lighting"];

const products = catalogData as Product[];

describe("Generated demo catalog (catalog.json)", () => {
  it("has between 40 and 50 products, per the blueprint's sizing note", () => {
    expect(products.length).toBeGreaterThanOrEqual(40);
    expect(products.length).toBeLessThanOrEqual(50);
  });

  it("has every product id unique", () => {
    const ids = products.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("covers all five required categories with at least one product each", () => {
    CATEGORIES.forEach((category) => {
      const count = products.filter((p) => p.category === category).length;
      expect(count).toBeGreaterThan(0);
    });
  });

  it("gives every product a positive integer price in cents", () => {
    products.forEach((p) => {
      expect(Number.isInteger(p.priceCents)).toBe(true);
      expect(p.priceCents).toBeGreaterThan(0);
    });
  });

  it("gives every product a positive footprint on all three axes", () => {
    products.forEach((p) => {
      expect(p.dimensions.width).toBeGreaterThan(0);
      expect(p.dimensions.depth).toBeGreaterThan(0);
      expect(p.dimensions.height).toBeGreaterThan(0);
    });
  });

  it("scores every product against all three themes, within 0-1", () => {
    products.forEach((p) => {
      expect(Object.keys(p.themeScores).sort()).toEqual([...THEMES].sort());
      Object.values(p.themeScores).forEach((score) => {
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(1);
      });
    });
  });

  it("gives every product at least one style tag", () => {
    products.forEach((p) => {
      expect(p.styleTags.length).toBeGreaterThan(0);
    });
  });

  it("only sets water usage on categories where it's meaningful", () => {
    const waterCategories: ProductCategory[] = ["toilet", "faucet", "shower"];
    products.forEach((p) => {
      if (p.waterUsage) {
        expect(waterCategories).toContain(p.category);
      }
    });
  });
});
