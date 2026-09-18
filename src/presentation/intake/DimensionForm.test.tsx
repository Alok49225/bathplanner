import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DimensionForm } from "./DimensionForm";
import type { RoomDimensions } from "./DimensionForm";

function baseValue(): RoomDimensions {
  return { widthIn: 60, lengthIn: 96, ceilingHeightIn: 96, doors: [], windows: [], plumbing: [] };
}

describe("DimensionForm", () => {
  it("renders the three dimension inputs with their current values", () => {
    render(<DimensionForm value={baseValue()} onChange={() => {}} />);
    expect(screen.getByLabelText("Width (in)")).toHaveValue(60);
    expect(screen.getByLabelText("Length (in)")).toHaveValue(96);
    expect(screen.getByLabelText("Ceiling height (in)")).toHaveValue(96);
  });

  it("shows the feet-and-inches hint alongside each dimension", () => {
    render(<DimensionForm value={{ ...baseValue(), ceilingHeightIn: 90 }} onChange={() => {}} />);
    expect(screen.getByText(`96 in ≈ 8'0"`)).toBeInTheDocument();
    expect(screen.getByText(`60 in ≈ 5'0"`)).toBeInTheDocument();
    expect(screen.getByText(`90 in ≈ 7'6"`)).toBeInTheDocument();
  });

  it("calls onChange with only the edited dimension changed", () => {
    const onChange = vi.fn();
    render(<DimensionForm value={baseValue()} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Width (in)"), { target: { value: "72" } });
    const lastCall = onChange.mock.calls.at(-1)?.[0] as RoomDimensions;
    expect(lastCall.widthIn).toBe(72);
    expect(lastCall.lengthIn).toBe(96);
  });

  it("propagates a door added in the child DoorList up through one onChange call", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<DimensionForm value={baseValue()} onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: "Add door" }));
    const lastCall = onChange.mock.calls.at(-1)?.[0] as RoomDimensions;
    expect(lastCall.doors).toHaveLength(1);
    expect(lastCall.windows).toHaveLength(0);
    expect(lastCall.widthIn).toBe(60); // untouched sibling fields preserved
  });

  it("propagates a plumbing point added in the child list", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<DimensionForm value={baseValue()} onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: "Add plumbing point" }));
    const lastCall = onChange.mock.calls.at(-1)?.[0] as RoomDimensions;
    expect(lastCall.plumbing).toHaveLength(1);
  });
});
