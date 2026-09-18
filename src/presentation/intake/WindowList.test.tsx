import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WindowList } from "./WindowList";
import type { Window as RoomWindow } from "../../domain/types/room";

const WINDOW_A: RoomWindow = { id: "a", wall: "north", offset: 20, widthIn: 24, sillHeightIn: 48 };
const WINDOW_B: RoomWindow = { id: "b", wall: "east", offset: 10, widthIn: 18, sillHeightIn: 40 };

describe("WindowList", () => {
  it("shows an empty-state message when there are no windows", () => {
    render(<WindowList value={[]} onChange={() => {}} />);
    expect(screen.getByText("No windows added.")).toBeInTheDocument();
  });

  it("appends a new window with sensible defaults when Add window is clicked", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<WindowList value={[]} onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: "Add window" }));
    const [added] = onChange.mock.calls[0][0] as RoomWindow[];
    expect(added.wall).toBe("north");
    expect(added.sillHeightIn).toBe(48);
    expect(added.id).toBeTruthy();
  });

  it("removes only the targeted window", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<WindowList value={[WINDOW_A, WINDOW_B]} onChange={onChange} />);
    const removeButtons = screen.getAllByRole("button", { name: "Remove" });
    await user.click(removeButtons[1]);
    expect(onChange).toHaveBeenCalledWith([WINDOW_A]);
  });

  it("updates only the edited window's sill height", () => {
    const onChange = vi.fn();
    render(<WindowList value={[WINDOW_A, WINDOW_B]} onChange={onChange} />);
    const sillInputs = screen.getAllByLabelText("Sill height (in)");
    fireEvent.change(sillInputs[1], { target: { value: "36" } });
    const lastCall = onChange.mock.calls.at(-1)?.[0] as RoomWindow[];
    expect(lastCall.find((w) => w.id === "b")?.sillHeightIn).toBe(36);
    expect(lastCall.find((w) => w.id === "a")?.sillHeightIn).toBe(48);
  });
});
