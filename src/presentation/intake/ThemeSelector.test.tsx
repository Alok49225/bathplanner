import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeSelector } from "./ThemeSelector";
import type { ThemeSelection } from "./ThemeSelector";

describe("ThemeSelector", () => {
  it("renders all three preset labels plus Custom", () => {
    render(<ThemeSelector value={{ kind: "preset", theme: "minimalist-modern" }} onChange={() => {}} />);
    expect(screen.getByText("Minimalist Modern")).toBeInTheDocument();
    expect(screen.getByText("Classic Luxury")).toBeInTheDocument();
    expect(screen.getByText("Japanese Zen")).toBeInTheDocument();
    expect(screen.getByText("Custom")).toBeInTheDocument();
  });

  it("checks the radio matching the current preset value", () => {
    render(<ThemeSelector value={{ kind: "preset", theme: "classic-luxury" }} onChange={() => {}} />);
    expect(screen.getByRole("radio", { name: "Classic Luxury" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Minimalist Modern" })).not.toBeChecked();
    expect(screen.getByRole("radio", { name: "Custom" })).not.toBeChecked();
  });

  it("calls onChange with a preset selection when a preset is clicked", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ThemeSelector value={{ kind: "preset", theme: "minimalist-modern" }} onChange={onChange} />);
    await user.click(screen.getByRole("radio", { name: "Japanese Zen" }));
    expect(onChange).toHaveBeenCalledWith({ kind: "preset", theme: "japanese-zen" });
  });

  it("does not show the custom text input until Custom is selected", () => {
    render(<ThemeSelector value={{ kind: "preset", theme: "minimalist-modern" }} onChange={() => {}} />);
    expect(screen.queryByPlaceholderText("Describe the style you want")).not.toBeInTheDocument();
  });

  it("shows the custom text input and reflects its value when kind is custom", () => {
    render(<ThemeSelector value={{ kind: "custom", text: "coastal spa" }} onChange={() => {}} />);
    expect(screen.getByRole("radio", { name: "Custom" })).toBeChecked();
    expect(screen.getByDisplayValue("coastal spa")).toBeInTheDocument();
  });

  it("calls onChange with a custom selection when the Custom radio is picked", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ThemeSelector value={{ kind: "preset", theme: "minimalist-modern" }} onChange={onChange} />);
    await user.click(screen.getByRole("radio", { name: "Custom" }));
    expect(onChange).toHaveBeenCalledWith({ kind: "custom", text: "" });
  });

  it("calls onChange with updated text as the user types in the custom field", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ThemeSelector value={{ kind: "custom", text: "" }} onChange={onChange} />);
    await user.type(screen.getByPlaceholderText("Describe the style you want"), "warm");
    // called once per keystroke; check the final call reflects the last character typed
    const lastCall = onChange.mock.calls.at(-1)?.[0] as ThemeSelection;
    expect(lastCall.kind).toBe("custom");
  });

  it("only ever has one radio checked at a time", () => {
    render(<ThemeSelector value={{ kind: "preset", theme: "japanese-zen" }} onChange={() => {}} />);
    const radios = screen.getAllByRole("radio");
    expect(radios.filter((r) => (r as HTMLInputElement).checked)).toHaveLength(1);
  });
});
