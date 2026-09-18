import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DoorList } from "./DoorList";
import type { Door } from "../../domain/types/room";

const DOOR_A: Door = { id: "a", wall: "south", offset: 12, widthIn: 28, swing: "right" };
const DOOR_B: Door = { id: "b", wall: "north", offset: 5, widthIn: 30, swing: "left" };

describe("DoorList", () => {
  it("shows an empty-state message when there are no doors", () => {
    render(<DoorList value={[]} onChange={() => {}} />);
    expect(screen.getByText("No doors added.")).toBeInTheDocument();
  });

  it("appends a new door with sensible defaults when Add door is clicked", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<DoorList value={[]} onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: "Add door" }));
    expect(onChange).toHaveBeenCalledTimes(1);
    const [added] = onChange.mock.calls[0][0] as Door[];
    expect(added.wall).toBe("south");
    expect(added.widthIn).toBe(28);
    expect(added.swing).toBe("right");
    expect(added.id).toBeTruthy();
  });

  it("removes only the targeted door, not an adjacent one", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<DoorList value={[DOOR_A, DOOR_B]} onChange={onChange} />);
    const removeButtons = screen.getAllByRole("button", { name: "Remove" });
    await user.click(removeButtons[0]);
    expect(onChange).toHaveBeenCalledWith([DOOR_B]);
  });

  it("updates only the edited door's field, leaving others untouched", () => {
    const onChange = vi.fn();
    render(<DoorList value={[DOOR_A, DOOR_B]} onChange={onChange} />);
    const offsetInputs = screen.getAllByLabelText("Offset (in)");
    fireEvent.change(offsetInputs[0], { target: { value: "20" } });
    const lastCall = onChange.mock.calls.at(-1)?.[0] as Door[];
    expect(lastCall.find((d) => d.id === "a")?.offset).toBe(20);
    expect(lastCall.find((d) => d.id === "b")?.offset).toBe(5);
  });

  it("renders each door's current wall and swing in its selects", () => {
    render(<DoorList value={[DOOR_A]} onChange={() => {}} />);
    expect(screen.getByLabelText("Wall")).toHaveValue("south");
    expect(screen.getByLabelText("Swing")).toHaveValue("right");
  });
});
