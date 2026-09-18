import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BudgetSlider } from "./BudgetSlider";

describe("BudgetSlider", () => {
  it("formats the initial value as currency", () => {
    render(<BudgetSlider valueCents={450000} onChange={() => {}} />);
    expect(screen.getByText("$4,500")).toBeInTheDocument();
  });

  it("calls onChange with the value in cents when the slider moves", () => {
    const onChange = vi.fn();
    render(<BudgetSlider valueCents={450000} onChange={onChange} />);
    fireEvent.change(screen.getByRole("slider"), { target: { value: "500000" } });
    expect(onChange).toHaveBeenCalledWith(500000);
  });

  it("sets min/max/step on the underlying input in cents", () => {
    render(
      <BudgetSlider valueCents={450000} onChange={() => {}} minCents={100000} maxCents={900000} stepCents={5000} />
    );
    const input = screen.getByRole("slider") as HTMLInputElement;
    expect(input.min).toBe("100000");
    expect(input.max).toBe("900000");
    expect(input.step).toBe("5000");
  });

  it("uses sensible defaults when min/max/step aren't provided", () => {
    render(<BudgetSlider valueCents={450000} onChange={() => {}} />);
    const input = screen.getByRole("slider") as HTMLInputElement;
    expect(input.min).toBe("50000");
    expect(input.max).toBe("2500000");
    expect(input.step).toBe("10000");
  });

  it("re-renders the formatted label when valueCents changes externally (controlled component)", () => {
    const { rerender } = render(<BudgetSlider valueCents={450000} onChange={() => {}} />);
    expect(screen.getByText("$4,500")).toBeInTheDocument();
    rerender(<BudgetSlider valueCents={800000} onChange={() => {}} />);
    expect(screen.getByText("$8,000")).toBeInTheDocument();
    expect(screen.queryByText("$4,500")).not.toBeInTheDocument();
  });

  it("rounds off cents in the display (whole dollars only)", () => {
    render(<BudgetSlider valueCents={450099} onChange={() => {}} />);
    expect(screen.getByText("$4,501")).toBeInTheDocument();
  });
});
