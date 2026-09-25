import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { PlumbingPointList } from "./PlumbingPointList";
import type { PlumbingPoint, RoomDimensions } from "../../domain/types/room";
import type { Product, ProductCategory } from "../../domain/types/product";

const POINT_A: PlumbingPoint = { id: "a", category: "toilet", position: { x: 10, y: 90 }, wall: "south" };
const POINT_B: PlumbingPoint = { id: "b", category: "vanity", position: { x: 50, y: 90 }, wall: "south" };

const ROOM: RoomDimensions = {
  widthIn: 60,
  lengthIn: 96,
  ceilingHeightIn: 96,
  doors: [],
  windows: [],
  plumbing: [],
};

function renderList(overrides: Partial<ComponentProps<typeof PlumbingPointList>> = {}) {
  return render(
    <PlumbingPointList
      value={[]}
      onChange={() => {}}
      room={ROOM}
      catalog={null}
      onAutoPlace={() => {}}
      {...overrides}
    />
  );
}

/** Same jsdom stand-in as FloorPlan.test.tsx — see its comment for why this is needed. */
function stubSvgTransform(svg: SVGSVGElement, pxPerInch: number) {
  (svg as unknown as { createSVGPoint: () => unknown }).createSVGPoint = () => {
    const point = {
      x: 0,
      y: 0,
      matrixTransform(m: { a: number; d: number }) {
        return { x: point.x * m.a, y: point.y * m.d };
      },
    };
    return point;
  };
  (svg as unknown as { getScreenCTM: () => unknown }).getScreenCTM = () => ({
    inverse: () => ({ a: 1 / pxPerInch, d: 1 / pxPerInch }),
  });
}

describe("PlumbingPointList", () => {
  it("shows an empty-state message when there are no points", () => {
    renderList();
    expect(screen.getByText("No plumbing points added.")).toBeInTheDocument();
  });

  it("appends a new point defaulting to toilet/south/(0,0)", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderList({ onChange });
    await user.click(screen.getByRole("button", { name: "Add plumbing point" }));
    const [added] = onChange.mock.calls[0][0] as PlumbingPoint[];
    expect(added.category).toBe("toilet");
    expect(added.wall).toBe("south");
    expect(added.position).toEqual({ x: 0, y: 0 });
  });

  it("removes only the targeted point", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderList({ value: [POINT_A, POINT_B], onChange });
    await user.click(screen.getAllByRole("button", { name: "Remove" })[0]);
    expect(onChange).toHaveBeenCalledWith([POINT_B]);
  });

  it("updates only the x coordinate of the edited point, keeping y intact", () => {
    const onChange = vi.fn();
    renderList({ value: [POINT_A], onChange });
    fireEvent.change(screen.getByLabelText("X (in)"), { target: { value: "15" } });
    const lastCall = onChange.mock.calls.at(-1)?.[0] as PlumbingPoint[];
    expect(lastCall[0].position).toEqual({ x: 15, y: 90 });
  });

  it("offers exactly the three floor-fixture categories in the dropdown", () => {
    renderList({ value: [POINT_A] });
    const select = screen.getByLabelText("Category") as HTMLSelectElement;
    const options = Array.from(select.options).map((o) => o.value);
    expect(options).toEqual(["toilet", "vanity", "shower"]);
  });

  describe("prevents duplicate categories", () => {
    it("Add plumbing point defaults to the next category not already present, not always toilet", async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();
      renderList({ value: [POINT_A], onChange }); // toilet already exists
      await user.click(screen.getByRole("button", { name: "Add plumbing point" }));
      const points = onChange.mock.calls.at(-1)?.[0] as PlumbingPoint[];
      expect(points.at(-1)?.category).toBe("vanity"); // next unused, not a second toilet
    });

    it("disables Add plumbing point once toilet, vanity, and shower are all present", () => {
      const points: PlumbingPoint[] = [
        POINT_A,
        POINT_B,
        { id: "s", category: "shower", position: { x: 20, y: 20 }, wall: "north" },
      ];
      renderList({ value: points });
      expect(screen.getByRole("button", { name: "Add plumbing point" })).toBeDisabled();
    });

    it("excludes a category already used by another row from that row's own Category dropdown", () => {
      renderList({ value: [POINT_A, POINT_B] });
      const selects = screen.getAllByLabelText("Category") as HTMLSelectElement[];
      const toiletRowOptions = Array.from(selects[0].options).map((o) => o.value);
      // toilet (its own current value) stays selectable, vanity is taken by the other row, shower is free
      expect(toiletRowOptions).toEqual(["toilet", "shower"]);
    });

    it("still lets a row keep its own category as an option even though it's technically 'taken'", () => {
      renderList({ value: [POINT_A] });
      const select = screen.getByLabelText("Category") as HTMLSelectElement;
      expect(select.value).toBe("toilet");
      expect(Array.from(select.options).map((o) => o.value)).toContain("toilet");
    });
  });

  describe("click-to-place", () => {
    it("does nothing until a category is selected", () => {
      const onChange = vi.fn();
      const { container } = renderList({ onChange });
      const svg = container.querySelector("svg")!;
      stubSvgTransform(svg, 10);
      fireEvent.click(svg, { clientX: 100, clientY: 100 });
      expect(onChange).not.toHaveBeenCalled();
    });

    it("creates a new point at the clicked room coordinates for the selected category", async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();
      const { container } = renderList({ onChange });
      await user.click(screen.getByRole("radio", { name: "Vanity" }));

      const svg = container.querySelector("svg")!;
      stubSvgTransform(svg, 10);
      fireEvent.click(svg, { clientX: 300, clientY: 150 });

      const points = onChange.mock.calls.at(-1)?.[0] as PlumbingPoint[];
      expect(points).toHaveLength(1);
      expect(points[0].category).toBe("vanity");
      expect(points[0].position).toEqual({ x: 30, y: 15 });
    });

    it("infers the nearest wall for a newly placed point rather than leaving it undefined", async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();
      const { container } = renderList({ onChange });
      await user.click(screen.getByRole("radio", { name: "Toilet" }));

      const svg = container.querySelector("svg")!;
      stubSvgTransform(svg, 10);
      // room is 60x96; clicking near y=0 (top) should infer the north wall
      fireEvent.click(svg, { clientX: 300, clientY: 10 });

      const points = onChange.mock.calls.at(-1)?.[0] as PlumbingPoint[];
      expect(points[0].wall).toBe("north");
    });

    it("moves the existing point for a category instead of creating a duplicate on a second click", async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();
      const { container, rerender } = renderList({ value: [POINT_B], onChange });
      await user.click(screen.getByRole("radio", { name: "Vanity" }));

      const svg = container.querySelector("svg")!;
      stubSvgTransform(svg, 10);
      fireEvent.click(svg, { clientX: 100, clientY: 200 });

      const points = onChange.mock.calls.at(-1)?.[0] as PlumbingPoint[];
      expect(points).toHaveLength(1); // still one vanity point, not two
      expect(points[0].id).toBe(POINT_B.id);
      expect(points[0].position).toEqual({ x: 10, y: 20 });

      // reflects immediately once the parent feeds the updated value back in
      rerender(
        <PlumbingPointList value={points} onChange={onChange} room={ROOM} catalog={null} onAutoPlace={() => {}} />
      );
      const marker = screen.getByTestId(`plumbing-${POINT_B.id}`);
      expect(Number(marker.getAttribute("cx"))).toBe(10);
      expect(Number(marker.getAttribute("cy"))).toBe(20);
    });

    it("recomputes wall when an existing point is moved, instead of leaving it stale", async () => {
      // POINT_B starts at (50, 90) with wall "south" — the nearest wall
      // there. Moving it to (10, 20) is nearest to "west" instead; if wall
      // isn't recomputed, fit-validator would keep checking clearance
      // against the wrong wall and can silently reject every product in
      // this category even though the new position is fine.
      const onChange = vi.fn();
      const user = userEvent.setup();
      const { container } = renderList({ value: [POINT_B], onChange });
      await user.click(screen.getByRole("radio", { name: "Vanity" }));

      const svg = container.querySelector("svg")!;
      stubSvgTransform(svg, 10);
      fireEvent.click(svg, { clientX: 100, clientY: 200 });

      const points = onChange.mock.calls.at(-1)?.[0] as PlumbingPoint[];
      expect(points[0].wall).toBe("west");
    });

    it("keeps the manual X/Y inputs usable after a point was placed by clicking", async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();
      const { container, rerender } = renderList({ onChange });
      await user.click(screen.getByRole("radio", { name: "Shower" }));

      const svg = container.querySelector("svg")!;
      stubSvgTransform(svg, 10);
      fireEvent.click(svg, { clientX: 200, clientY: 300 });
      const placed = (onChange.mock.calls.at(-1)?.[0] as PlumbingPoint[])[0];

      rerender(
        <PlumbingPointList value={[placed]} onChange={onChange} room={ROOM} catalog={null} onAutoPlace={() => {}} />
      );
      fireEvent.change(screen.getByLabelText("X (in)"), { target: { value: "5" } });
      const afterManualEdit = onChange.mock.calls.at(-1)?.[0] as PlumbingPoint[];
      expect(afterManualEdit[0].position).toEqual({ x: 5, y: placed.position.y });
    });

    it("clamps a placed point to the room bounds", async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();
      const { container } = renderList({ onChange });
      await user.click(screen.getByRole("radio", { name: "Toilet" }));

      const svg = container.querySelector("svg")!;
      stubSvgTransform(svg, 10);
      fireEvent.click(svg, { clientX: 100000, clientY: 100000 });

      const points = onChange.mock.calls.at(-1)?.[0] as PlumbingPoint[];
      expect(points[0].position).toEqual({ x: ROOM.widthIn, y: ROOM.lengthIn });
    });

    it("shows markers for toilet, vanity, and shower placed together, all still visible", () => {
      const points: PlumbingPoint[] = [
        { id: "t", category: "toilet", position: { x: 10, y: 10 }, wall: "north" },
        { id: "v", category: "vanity", position: { x: 30, y: 90 }, wall: "south" },
        { id: "s", category: "shower", position: { x: 50, y: 10 }, wall: "north" },
      ];
      renderList({ value: points });
      expect(screen.getByTestId("plumbing-t")).toBeInTheDocument();
      expect(screen.getByTestId("plumbing-v")).toBeInTheDocument();
      expect(screen.getByTestId("plumbing-s")).toBeInTheDocument();
    });
  });

  describe("auto-place fixtures", () => {
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

    // Small enough that toilet + vanity + shower all fit comfortably along
    // the walls of a real (not tiny) room — proves the button actually
    // drives the real placement-solver.ts, not a stub.
    const CATALOG: Product[] = [
      makeProduct("toilet-1", "toilet", 20, 26),
      makeProduct("vanity-1", "vanity", 30, 21),
      makeProduct("shower-1", "shower", 32, 32),
    ];

    it("is disabled while the catalog is still loading", () => {
      renderList({ catalog: null });
      expect(screen.getByRole("button", { name: "Auto-place fixtures" })).toBeDisabled();
    });

    it("calls onAutoPlace with a point per category and no omissions in a generously sized room", async () => {
      const onAutoPlace = vi.fn();
      const user = userEvent.setup();
      renderList({ catalog: CATALOG, onAutoPlace, room: { ...ROOM, widthIn: 96, lengthIn: 96 } });
      await user.click(screen.getByRole("button", { name: "Auto-place fixtures" }));

      await waitFor(() => expect(onAutoPlace).toHaveBeenCalledTimes(1));
      const result = onAutoPlace.mock.calls[0][0];
      expect(result.omittedFixtures).toEqual([]);
      expect(result.plumbing.map((p: PlumbingPoint) => p.category).sort()).toEqual(["shower", "toilet", "vanity"]);
      result.plumbing.forEach((p: PlumbingPoint) => expect(p.id).toMatch(/^plumbing-/));
    });

    it("shows an error and never calls onAutoPlace when even a toilet can't fit", async () => {
      const onAutoPlace = vi.fn();
      const user = userEvent.setup();
      // A 1x1in room: no wall segment is long or deep enough for anything.
      renderList({ catalog: CATALOG, onAutoPlace, room: { ...ROOM, widthIn: 1, lengthIn: 1 } });
      await user.click(screen.getByRole("button", { name: "Auto-place fixtures" }));

      await waitFor(() =>
        expect(screen.getByText(/Auto-place couldn't fit even a toilet/)).toBeInTheDocument()
      );
      expect(onAutoPlace).not.toHaveBeenCalled();
    });
  });
});
