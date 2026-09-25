import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DimensionForm } from "./DimensionForm";
import type { RoomDimensions } from "./DimensionForm";
import type { Product, ProductCategory } from "../../domain/types/product";

function baseValue(): RoomDimensions {
  return { widthIn: 60, lengthIn: 96, ceilingHeightIn: 96, doors: [], windows: [], plumbing: [] };
}

function makeProduct(id: string, category: ProductCategory, width: number, depth: number): Product {
  return {
    id,
    category,
    name: id,
    brand: "Kohler",
    priceCents: 30000,
    finish: "white",
    dimensions: { width, depth, height: 30 },
    installComplexity: "standard",
    styleTags: [],
    themeScores: { "minimalist-modern": 0.5, "classic-luxury": 0.5, "japanese-zen": 0.5 },
    finishFamily: "test",
  };
}

const CATALOG: Product[] = [
  makeProduct("toilet-1", "toilet", 20, 26),
  makeProduct("vanity-1", "vanity", 30, 21),
  makeProduct("shower-1", "shower", 32, 32),
];

describe("DimensionForm", () => {
  it("renders the three dimension inputs with their current values", () => {
    render(<DimensionForm value={baseValue()} onChange={() => {}} catalog={null} />);
    expect(screen.getByLabelText("Width (in)")).toHaveValue(60);
    expect(screen.getByLabelText("Length (in)")).toHaveValue(96);
    expect(screen.getByLabelText("Ceiling height (in)")).toHaveValue(96);
  });

  it("shows the feet-and-inches hint alongside each dimension", () => {
    render(<DimensionForm value={{ ...baseValue(), ceilingHeightIn: 90 }} onChange={() => {}} catalog={null} />);
    expect(screen.getByText(`96 in ≈ 8'0"`)).toBeInTheDocument();
    expect(screen.getByText(`60 in ≈ 5'0"`)).toBeInTheDocument();
    expect(screen.getByText(`90 in ≈ 7'6"`)).toBeInTheDocument();
  });

  it("calls onChange with only the edited dimension changed", () => {
    const onChange = vi.fn();
    render(<DimensionForm value={baseValue()} onChange={onChange} catalog={null} />);
    fireEvent.change(screen.getByLabelText("Width (in)"), { target: { value: "72" } });
    const lastCall = onChange.mock.calls.at(-1)?.[0] as RoomDimensions;
    expect(lastCall.widthIn).toBe(72);
    expect(lastCall.lengthIn).toBe(96);
  });

  it("propagates a door added in the child DoorList up through one onChange call", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<DimensionForm value={baseValue()} onChange={onChange} catalog={null} />);
    await user.click(screen.getByRole("button", { name: "Add door" }));
    const lastCall = onChange.mock.calls.at(-1)?.[0] as RoomDimensions;
    expect(lastCall.doors).toHaveLength(1);
    expect(lastCall.windows).toHaveLength(0);
    expect(lastCall.widthIn).toBe(60); // untouched sibling fields preserved
  });

  it("propagates a plumbing point added in the child list", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<DimensionForm value={baseValue()} onChange={onChange} catalog={null} />);
    await user.click(screen.getByRole("button", { name: "Add plumbing point" }));
    const lastCall = onChange.mock.calls.at(-1)?.[0] as RoomDimensions;
    expect(lastCall.plumbing).toHaveLength(1);
  });

  it("resets omittedFixtures to [] on a manual plumbing edit, since it's stale the moment the user hand-manages points again", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    const value: RoomDimensions = { ...baseValue(), omittedFixtures: ["vanity"] };
    render(<DimensionForm value={value} onChange={onChange} catalog={null} />);
    await user.click(screen.getByRole("button", { name: "Add plumbing point" }));
    const lastCall = onChange.mock.calls.at(-1)?.[0] as RoomDimensions;
    expect(lastCall.omittedFixtures).toEqual([]);
  });

  it("passes an auto-place result's plumbing and omittedFixtures through untouched", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    const value: RoomDimensions = { ...baseValue(), widthIn: 96, lengthIn: 96 };
    render(<DimensionForm value={value} onChange={onChange} catalog={CATALOG} />);
    await user.click(screen.getByRole("button", { name: "Auto-place fixtures" }));

    await waitFor(() => expect(onChange).toHaveBeenCalled());
    const lastCall = onChange.mock.calls.at(-1)?.[0] as RoomDimensions;
    expect(lastCall.omittedFixtures).toEqual([]);
    expect(lastCall.plumbing.map((p) => p.category).sort()).toEqual(["shower", "toilet", "vanity"]);
    expect(lastCall.widthIn).toBe(96); // untouched sibling fields preserved
  });
});
