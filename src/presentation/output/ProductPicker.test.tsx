import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProductPicker } from "./ProductPicker";
import type { Product } from "../../domain/types/product";

function makeProduct(id: string, overrides: Partial<Product> = {}): Product {
  return {
    id,
    category: "toilet",
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

const PRODUCTS: Product[] = [
  makeProduct("mid", { name: "Cimarron", priceCents: 45000, finish: "white" }),
  makeProduct("cheap", { name: "Highline", priceCents: 29900, finish: "white" }),
  makeProduct("premium", { name: "Veil", priceCents: 60000, brand: "Kohler", finish: "matte-black" }),
];

describe("ProductPicker", () => {
  it("lists every option sorted cheapest first, regardless of input order", () => {
    render(
      <ProductPicker category="toilet" products={PRODUCTS} selectedProductId="mid" onSelect={() => {}} onClose={() => {}} />
    );
    const names = screen.getAllByText(/Kohler,/).map((el) => el.textContent);
    expect(names[0]).toContain("Highline");
    expect(names[1]).toContain("Cimarron");
    expect(names[2]).toContain("Veil");
  });

  it("shows each option's price", () => {
    render(
      <ProductPicker category="toilet" products={PRODUCTS} selectedProductId="mid" onSelect={() => {}} onClose={() => {}} />
    );
    expect(screen.getByText("$299")).toBeInTheDocument();
    expect(screen.getByText("$450")).toBeInTheDocument();
    expect(screen.getByText("$600")).toBeInTheDocument();
  });

  it("badges the currently selected product instead of giving it a Select button", () => {
    render(
      <ProductPicker category="toilet" products={PRODUCTS} selectedProductId="mid" onSelect={() => {}} onClose={() => {}} />
    );
    expect(screen.getByText("Selected")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Select" })).toHaveLength(2); // the other two
  });

  it("calls onSelect with the clicked product's id, not the currently selected one", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(
      <ProductPicker category="toilet" products={PRODUCTS} selectedProductId="mid" onSelect={onSelect} onClose={() => {}} />
    );
    const rows = screen.getAllByRole("listitem");
    const cheapRow = rows.find((r) => r.textContent?.includes("Highline"))!;
    await user.click(cheapRow.querySelector("button")!);
    expect(onSelect).toHaveBeenCalledWith("cheap");
  });

  it("calls onClose when the close button is clicked", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <ProductPicker category="toilet" products={PRODUCTS} selectedProductId="mid" onSelect={() => {}} onClose={onClose} />
    );
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose when the backdrop is clicked, but not when the dialog itself is clicked", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    const { container } = render(
      <ProductPicker category="toilet" products={PRODUCTS} selectedProductId="mid" onSelect={() => {}} onClose={onClose} />
    );
    await user.click(screen.getByRole("dialog"));
    expect(onClose).not.toHaveBeenCalled();

    await user.click(container.querySelector(".product-picker-backdrop")!);
    expect(onClose).toHaveBeenCalled();
  });

  it("labels the dialog with the category being picked", () => {
    render(
      <ProductPicker category="vanity" products={PRODUCTS} selectedProductId="mid" onSelect={() => {}} onClose={() => {}} />
    );
    expect(screen.getByRole("dialog", { name: "Choose a Vanity" })).toBeInTheDocument();
  });
});
