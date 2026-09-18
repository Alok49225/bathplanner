import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PlumbingPointList } from "./PlumbingPointList";
import type { PlumbingPoint } from "../../domain/types/room";

const POINT_A: PlumbingPoint = { id: "a", category: "toilet", position: { x: 10, y: 90 }, wall: "south" };
const POINT_B: PlumbingPoint = { id: "b", category: "vanity", position: { x: 50, y: 90 }, wall: "south" };

describe("PlumbingPointList", () => {
  it("shows an empty-state message when there are no points", () => {
    render(<PlumbingPointList value={[]} onChange={() => {}} />);
    expect(screen.getByText("No plumbing points added.")).toBeInTheDocument();
  });

  it("appends a new point defaulting to toilet/south/(0,0)", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<PlumbingPointList value={[]} onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: "Add plumbing point" }));
    const [added] = onChange.mock.calls[0][0] as PlumbingPoint[];
    expect(added.category).toBe("toilet");
    expect(added.wall).toBe("south");
    expect(added.position).toEqual({ x: 0, y: 0 });
  });

  it("removes only the targeted point", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<PlumbingPointList value={[POINT_A, POINT_B]} onChange={onChange} />);
    await user.click(screen.getAllByRole("button", { name: "Remove" })[0]);
    expect(onChange).toHaveBeenCalledWith([POINT_B]);
  });

  it("updates only the x coordinate of the edited point, keeping y intact", () => {
    const onChange = vi.fn();
    render(<PlumbingPointList value={[POINT_A]} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("X (in)"), { target: { value: "15" } });
    const lastCall = onChange.mock.calls.at(-1)?.[0] as PlumbingPoint[];
    expect(lastCall[0].position).toEqual({ x: 15, y: 90 });
  });

  it("offers exactly the three floor-fixture categories in the dropdown", () => {
    render(<PlumbingPointList value={[POINT_A]} onChange={() => {}} />);
    const select = screen.getByLabelText("Category") as HTMLSelectElement;
    const options = Array.from(select.options).map((o) => o.value);
    expect(options).toEqual(["toilet", "vanity", "shower"]);
  });
});
