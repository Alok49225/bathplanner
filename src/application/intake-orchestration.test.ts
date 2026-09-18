import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useIntakeSolve } from "./intake-orchestration";
import type { CatalogRepository } from "../domain/catalog-repository";
import type { Product, ProductCategory } from "../domain/types/product";
import type { SessionState } from "./session-state";
import type { RoomDimensions } from "../domain/types/room";

function makeProduct(id: string, category: ProductCategory, priceCents: number): Product {
  return {
    id,
    category,
    name: id,
    brand: "Kohler",
    priceCents,
    finish: "white",
    dimensions: { width: 10, depth: 10, height: 10 },
    installComplexity: "standard",
    styleTags: [],
    themeScores: { "minimalist-modern": 0.5, "classic-luxury": 0.5, "japanese-zen": 0.5 },
    finishFamily: "test",
  };
}

const DEBOUNCE_TEST_MS = 400;

const CATALOG: Product[] = [
  makeProduct("toilet-1", "toilet", 30000),
  makeProduct("vanity-1", "vanity", 80000),
  makeProduct("faucet-1", "faucet", 20000),
  makeProduct("shower-1", "shower", 100000),
  makeProduct("lighting-1", "lighting", 15000),
];

class FakeCatalogRepository implements CatalogRepository {
  private readonly products: Product[];
  private readonly fail: boolean;

  constructor(products: Product[], fail = false) {
    this.products = products;
    this.fail = fail;
  }
  async getAll(): Promise<Product[]> {
    if (this.fail) throw new Error("network error");
    return this.products;
  }
  async getById(id: string): Promise<Product | undefined> {
    return this.products.find((p) => p.id === id);
  }
}

const ROOM: RoomDimensions = {
  widthIn: 200,
  lengthIn: 200,
  ceilingHeightIn: 96,
  doors: [],
  windows: [],
  plumbing: [
    { id: "t", category: "toilet", position: { x: 20, y: 190 }, wall: "south" },
    { id: "v", category: "vanity", position: { x: 100, y: 190 }, wall: "south" },
    { id: "s", category: "shower", position: { x: 20, y: 20 }, wall: "north" },
  ],
};

function baseSession(overrides: Partial<SessionState> = {}): SessionState {
  return {
    room: ROOM,
    budgetCents: 300000,
    theme: { kind: "preset", theme: "minimalist-modern" },
    ...overrides,
  };
}

async function flushMicrotasks() {
  await act(async () => {
    await Promise.resolve();
  });
}

/**
 * renderHook(() => useIntakeSolve(baseSession(), repo)) would call
 * baseSession() fresh on every re-render, handing the hook a new object
 * reference each time — since the hook's effect depends on that reference,
 * this retriggers the effect forever (an infinite render loop that hangs
 * the test run). Passing the session in as a stable prop, the same way
 * the "resets the debounce timer" test already had to, avoids it.
 */
function renderIntakeSolve(session: SessionState, repo: CatalogRepository) {
  return renderHook(({ session }) => useIntakeSolve(session, repo), { initialProps: { session } });
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("useIntakeSolve", () => {
  it("starts in loading-catalog before the repository resolves", () => {
    const repo = new FakeCatalogRepository(CATALOG);
    const { result } = renderIntakeSolve(baseSession(), repo);
    expect(result.current.status).toBe("loading-catalog");
  });

  it("moves to no-preset-theme once the catalog loads, if the theme is custom", async () => {
    const repo = new FakeCatalogRepository(CATALOG);
    const { result } = renderIntakeSolve(baseSession({ theme: { kind: "custom", text: "coastal" } }), repo);
    await flushMicrotasks();
    expect(result.current.status).toBe("no-preset-theme");
  });

  it("returns catalog-error if the repository rejects", async () => {
    const repo = new FakeCatalogRepository(CATALOG, true);
    const { result } = renderIntakeSolve(baseSession(), repo);
    await flushMicrotasks();
    expect(result.current.status).toBe("catalog-error");
  });

  it("moves to solving immediately once the catalog is ready, before the debounce fires", async () => {
    const repo = new FakeCatalogRepository(CATALOG);
    const { result } = renderIntakeSolve(baseSession(), repo);
    await flushMicrotasks();
    expect(result.current.status).toBe("solving");
  });

  it("does not resolve before 400ms of no further changes", async () => {
    const repo = new FakeCatalogRepository(CATALOG);
    const { result } = renderIntakeSolve(baseSession(), repo);
    await flushMicrotasks();
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current.status).toBe("solving");
  });

  it("resets the debounce timer on every session change instead of solving on the first one", async () => {
    const repo = new FakeCatalogRepository(CATALOG);
    const { result, rerender } = renderIntakeSolve(baseSession(), repo);
    await flushMicrotasks();
    expect(result.current.status).toBe("solving");

    act(() => {
      vi.advanceTimersByTime(200);
    });
    rerender({ session: baseSession({ budgetCents: 310000 }) });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current.status).toBe("solving"); // only 200ms since the rerender, old timer was cleared

    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current.status).toBe("solved"); // 400ms since the rerender
  });

  it("resolves to solved with three tiers for a feasible budget", async () => {
    const repo = new FakeCatalogRepository(CATALOG);
    const { result } = renderIntakeSolve(baseSession(), repo);
    await flushMicrotasks();
    act(() => {
      vi.advanceTimersByTime(DEBOUNCE_TEST_MS);
    });
    expect(result.current.status).toBe("solved");
    expect(result.current.tiers).toHaveLength(3);
  });

  it("resolves to infeasible with the shortfall for too low a budget", async () => {
    const repo = new FakeCatalogRepository(CATALOG);
    const { result } = renderIntakeSolve(baseSession({ budgetCents: 1000 }), repo);
    await flushMicrotasks();
    act(() => {
      vi.advanceTimersByTime(DEBOUNCE_TEST_MS);
    });
    expect(result.current.status).toBe("infeasible");
    expect(result.current.infeasibleReason).toBe("over-budget");
    expect(result.current.cheapestPossibleCents).toBeGreaterThan(1000);
  });

  it("resolves to infeasible with the real reason (not a budget one) when nothing physically fits the room", async () => {
    const repo = new FakeCatalogRepository(CATALOG);
    const tinyRoom: RoomDimensions = {
      ...ROOM,
      widthIn: 2,
      lengthIn: 2,
    };
    const { result } = renderIntakeSolve(baseSession({ room: tinyRoom, budgetCents: 10_000_000 }), repo);
    await flushMicrotasks();
    act(() => {
      vi.advanceTimersByTime(DEBOUNCE_TEST_MS);
    });
    expect(result.current.status).toBe("infeasible");
    expect(result.current.infeasibleReason).toBe("no-eligible-options");
    // no dollar figure at all for this reason — a budget-shaped number here would be the bug
    expect(result.current.cheapestPossibleCents).toBeUndefined();
    expect(result.current.issues?.length).toBeGreaterThan(0);
  });
});
