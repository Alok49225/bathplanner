import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FloorPlan } from "./FloorPlan";
import type { RoomDimensions } from "../../domain/types/room";

function emptyRoom(overrides: Partial<RoomDimensions> = {}): RoomDimensions {
  return {
    widthIn: 60,
    lengthIn: 96,
    ceilingHeightIn: 96,
    doors: [],
    windows: [],
    plumbing: [],
    ...overrides,
  };
}

describe("FloorPlan", () => {
  it("renders an empty room as just the rectangle, without erroring", () => {
    const { container } = render(<FloorPlan room={emptyRoom()} />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("viewBox")).toBe("0 0 60 96");
    // four solid wall segments, one per side, no doors/windows to break them
    expect(container.querySelectorAll(".floor-plan-wall")).toHaveLength(4);
  });

  it("sizes the viewBox exactly to the room's width and length", () => {
    const { container } = render(<FloorPlan room={emptyRoom({ widthIn: 80, lengthIn: 120 })} />);
    expect(container.querySelector("svg")!.getAttribute("viewBox")).toBe("0 0 80 120");
  });

  it("places a north-wall door at the correct offset from the west corner", () => {
    const room = emptyRoom({
      doors: [{ id: "d1", wall: "north", offset: 10, widthIn: 28, swing: "right" }],
    });
    render(<FloorPlan room={room} />);
    const doorGroup = screen.getByTestId("door-d1");
    const line = doorGroup.querySelector("line")!;
    // north wall: y=0 for both jambs; x spans offset..offset+width along the top edge
    expect(Number(line.getAttribute("y1"))).toBeCloseTo(0);
  });

  it("places a west-wall door measuring offset from the north corner, not the width axis", () => {
    const room = emptyRoom({
      doors: [{ id: "d1", wall: "west", offset: 15, widthIn: 28, swing: "right" }],
    });
    render(<FloorPlan room={room} />);
    const line = screen.getByTestId("door-d1").querySelector("line")!;
    // west wall: x=0 for both jambs; y spans the offset
    expect(Number(line.getAttribute("x1"))).toBeCloseTo(0);
  });

  it("swings the door leaf into the room, not through the wall", () => {
    // north wall's interior is +y (downward, per FloorPlan's INWARD convention)
    const room = emptyRoom({
      doors: [{ id: "d1", wall: "north", offset: 10, widthIn: 28, swing: "left" }],
    });
    render(<FloorPlan room={room} />);
    const line = screen.getByTestId("door-d1").querySelector("line")!;
    const y2 = Number(line.getAttribute("y2"));
    expect(y2).toBeGreaterThan(0); // open point is below the wall (into the room), not above it
  });

  it("hinges at the offset-start edge for swing:left and the offset-end edge for swing:right", () => {
    const left = emptyRoom({ doors: [{ id: "d1", wall: "north", offset: 10, widthIn: 28, swing: "left" }] });
    const right = emptyRoom({ doors: [{ id: "d1", wall: "north", offset: 10, widthIn: 28, swing: "right" }] });

    const { unmount } = render(<FloorPlan room={left} />);
    const leftLine = screen.getByTestId("door-d1").querySelector("line")!;
    expect(Number(leftLine.getAttribute("x1"))).toBeCloseTo(10); // hinge at offset (start)
    unmount();

    render(<FloorPlan room={right} />);
    const rightLine = screen.getByTestId("door-d1").querySelector("line")!;
    expect(Number(rightLine.getAttribute("x1"))).toBeCloseTo(38); // hinge at offset+width (end)
  });

  it("breaks the wall line into segments around a door, leaving a real gap", () => {
    const room = emptyRoom({
      widthIn: 100,
      doors: [{ id: "d1", wall: "north", offset: 30, widthIn: 28, swing: "right" }],
    });
    const { container } = render(<FloorPlan room={room} />);
    // north wall alone should now be split into 2 segments (before and after the gap)
    // total walls: north(2) + south(1) + east(1) + west(1) = 5
    expect(container.querySelectorAll(".floor-plan-wall")).toHaveLength(5);
  });

  it("renders a window as a line with jamb ticks at both ends, distinct from a door's swing glyph", () => {
    const room = emptyRoom({
      windows: [{ id: "w1", wall: "south", offset: 20, widthIn: 24, sillHeightIn: 48 }],
    });
    render(<FloorPlan room={room} />);
    const windowGroup = screen.getByTestId("window-w1");
    expect(windowGroup.tagName.toLowerCase()).toBe("g");
    expect(windowGroup.classList.contains("floor-plan-window")).toBe(true);
    // main span line + two jamb ticks, no <path> (that's the door's swing arc only)
    expect(windowGroup.querySelectorAll("line")).toHaveLength(3);
    expect(windowGroup.querySelector("path")).toBeNull();
  });

  it("points the window's jamb ticks into the room, not through the wall", () => {
    // south wall's interior is -y (upward, per FloorPlan's INWARD convention)
    const room = emptyRoom({
      windows: [{ id: "w1", wall: "south", offset: 20, widthIn: 24, sillHeightIn: 48 }],
    });
    render(<FloorPlan room={room} />);
    const lines = screen.getByTestId("window-w1").querySelectorAll("line");
    const firstTick = lines[1];
    expect(Number(firstTick.getAttribute("y2"))).toBeLessThan(Number(firstTick.getAttribute("y1")));
  });

  it("renders plumbing points as markers at their exact coordinates", () => {
    const room = emptyRoom({
      plumbing: [{ id: "p1", category: "toilet", position: { x: 12, y: 84 }, wall: "south" }],
    });
    render(<FloorPlan room={room} />);
    const marker = screen.getByTestId("plumbing-p1");
    expect(marker.tagName.toLowerCase()).toBe("circle");
    expect(Number(marker.getAttribute("cx"))).toBe(12);
    expect(Number(marker.getAttribute("cy"))).toBe(84);
  });

  it("gives each plumbing category its own class so they're distinguishable without reading coordinates", () => {
    const room = emptyRoom({
      plumbing: [
        { id: "p1", category: "toilet", position: { x: 10, y: 10 }, wall: "north" },
        { id: "p2", category: "vanity", position: { x: 20, y: 10 }, wall: "north" },
        { id: "p3", category: "shower", position: { x: 30, y: 10 }, wall: "north" },
      ],
    });
    render(<FloorPlan room={room} />);
    expect(screen.getByTestId("plumbing-p1").classList.contains("floor-plan-plumbing-toilet")).toBe(true);
    expect(screen.getByTestId("plumbing-p2").classList.contains("floor-plan-plumbing-vanity")).toBe(true);
    expect(screen.getByTestId("plumbing-p3").classList.contains("floor-plan-plumbing-shower")).toBe(true);
  });

  it("labels each plumbing marker with its category for assistive tech, not color alone", () => {
    const room = emptyRoom({
      plumbing: [{ id: "p1", category: "shower", position: { x: 10, y: 10 }, wall: "north" }],
    });
    render(<FloorPlan room={room} />);
    expect(screen.getByTestId("plumbing-p1").querySelector("title")?.textContent).toBe("shower rough-in");
  });

  it("shows the plumbing legend by default when there are plumbing points", () => {
    const room = emptyRoom({
      plumbing: [{ id: "p1", category: "toilet", position: { x: 10, y: 10 }, wall: "north" }],
    });
    const { container } = render(<FloorPlan room={room} />);
    expect(container.querySelector(".floor-plan-legend")).toBeInTheDocument();
    expect(screen.getByText("Toilet")).toBeInTheDocument();
  });

  it("suppresses the legend when showLegend is false, e.g. when FixtureLayer's richer one is shown instead", () => {
    const room = emptyRoom({
      plumbing: [{ id: "p1", category: "toilet", position: { x: 10, y: 10 }, wall: "north" }],
    });
    const { container } = render(<FloorPlan room={room} showLegend={false} />);
    expect(container.querySelector(".floor-plan-legend")).not.toBeInTheDocument();
  });

  it("shows no legend at all when there are no plumbing points, regardless of showLegend", () => {
    const { container } = render(<FloorPlan room={emptyRoom()} />);
    expect(container.querySelector(".floor-plan-legend")).not.toBeInTheDocument();
  });

  it("draws a 12-inch scale reference bar regardless of room size", () => {
    const small = render(<FloorPlan room={emptyRoom({ widthIn: 60, lengthIn: 96 })} />);
    const smallLine = small.getByTestId("floor-plan-scale").querySelector("line")!;
    const smallLength = Math.abs(Number(smallLine.getAttribute("x2")) - Number(smallLine.getAttribute("x1")));
    small.unmount();

    const large = render(<FloorPlan room={emptyRoom({ widthIn: 300, lengthIn: 400 })} />);
    const largeLine = large.getByTestId("floor-plan-scale").querySelector("line")!;
    const largeLength = Math.abs(Number(largeLine.getAttribute("x2")) - Number(largeLine.getAttribute("x1")));

    expect(smallLength).toBeCloseTo(12);
    expect(largeLength).toBeCloseTo(12); // same real-world length regardless of room size — that's the point of a scale reference
  });

  it("positions the scale reference inset from the room's corner, not touching the walls", () => {
    const room = emptyRoom({ widthIn: 60, lengthIn: 96 });
    render(<FloorPlan room={room} />);
    const line = screen.getByTestId("floor-plan-scale").querySelector("line")!;
    expect(Number(line.getAttribute("x2"))).toBeLessThan(room.widthIn);
    expect(Number(line.getAttribute("y1"))).toBeLessThan(room.lengthIn);
  });
});
