import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useChatSolve } from "./chat-orchestration";
import type { CatalogRepository } from "../domain/catalog-repository";
import type { Product, ProductCategory } from "../domain/types/product";
import type { SessionState } from "./session-state";
import type { RoomDimensions } from "../domain/types/room";
import type { Bundle, BundleLineItem, BundleTier } from "../domain/types/bundle";
import type { IntakeSolveResult } from "./intake-orchestration";

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

// A price ladder for toilet specifically, so swap-item has real neighbors to find.
const CATALOG: Product[] = [
  makeProduct("toilet-cheap", "toilet", 30000),
  makeProduct("toilet-mid", "toilet", 45000),
  makeProduct("toilet-premium", "toilet", 60000),
  makeProduct("vanity-1", "vanity", 80000),
  makeProduct("faucet-1", "faucet", 20000),
  makeProduct("shower-1", "shower", 100000),
  makeProduct("lighting-1", "lighting", 15000),
];

class FakeCatalogRepository implements CatalogRepository {
  private readonly products: Product[];
  constructor(products: Product[]) {
    this.products = products;
  }
  async getAll(): Promise<Product[]> {
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
    budgetCents: 500000,
    theme: { kind: "preset", theme: "minimalist-modern" },
    ...overrides,
  };
}

function makeItem(productId: string, category: ProductCategory): BundleLineItem {
  return { category, productId, placement: { position: { x: 0, y: 0 } } };
}

function makeBundle(tier: BundleTier, toiletProductId = "toilet-mid"): Bundle {
  return {
    id: `bundle-${tier}`,
    tier,
    items: {
      toilet: makeItem(toiletProductId, "toilet"),
      vanity: makeItem("vanity-1", "vanity"),
      faucet: makeItem("faucet-1", "faucet"),
      shower: makeItem("shower-1", "shower"),
      lighting: makeItem("lighting-1", "lighting"),
    },
    totalPriceCents: 260000,
    budgetCents: 500000,
    warnings: [],
  };
}

const SOLVED: IntakeSolveResult = {
  status: "solved",
  tiers: [makeBundle("value"), makeBundle("balanced"), makeBundle("premium")],
};

async function flushMicrotasks() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

function renderChatSolve(overrides: {
  session?: SessionState;
  repository?: CatalogRepository;
  solve?: IntakeSolveResult;
  selectedTier?: BundleTier;
} = {}) {
  const patchSession = vi.fn();
  const args = {
    session: overrides.session ?? baseSession(),
    patchSession,
    repository: overrides.repository ?? new FakeCatalogRepository(CATALOG),
    solve: overrides.solve ?? SOLVED,
    selectedTier: overrides.selectedTier ?? "balanced",
  };
  const rendered = renderHook((props) => useChatSolve(props), { initialProps: args });
  return { ...rendered, patchSession };
}

describe("useChatSolve", () => {
  describe("change-budget", () => {
    it("patches the session with an absolute budget, the same way BudgetSlider does", () => {
      const { result, patchSession } = renderChatSolve();
      act(() => result.current.sendMessage("set my budget to $6000"));
      expect(patchSession).toHaveBeenCalledWith({ budgetCents: 600000 });
    });

    it("patches the session with the current budget plus a delta", () => {
      const { result, patchSession } = renderChatSolve({ session: baseSession({ budgetCents: 300000 }) });
      act(() => result.current.sendMessage("increase my budget by $500"));
      expect(patchSession).toHaveBeenCalledWith({ budgetCents: 350000 });
    });

    it("clamps a decrease at zero instead of going negative", () => {
      const { result, patchSession } = renderChatSolve({ session: baseSession({ budgetCents: 20000 }) });
      act(() => result.current.sendMessage("lower the budget by $500"));
      expect(patchSession).toHaveBeenCalledWith({ budgetCents: 0 });
    });

    it("confirms the change in the message log", () => {
      const { result } = renderChatSolve();
      act(() => result.current.sendMessage("set my budget to $6000"));
      expect(result.current.messages.at(-1)?.text).toContain("$6,000");
    });
  });

  describe("pin-item", () => {
    it("pins whatever's currently in that category for the selected tier", async () => {
      const { result } = renderChatSolve({ selectedTier: "balanced" });
      act(() => result.current.sendMessage("keep the toilet"));
      await flushMicrotasks();
      expect(result.current.pinnedBundle?.items.toilet.productId).toBe("toilet-mid");
      expect(result.current.messages.at(-1)?.text).toContain("toilet-mid");
    });

    it("replies without pinning anything when there's no solved bundle yet", async () => {
      const { result } = renderChatSolve({ solve: { status: "solving" } });
      act(() => result.current.sendMessage("keep the toilet"));
      await flushMicrotasks();
      expect(result.current.pinnedBundle).toBeNull();
      expect(result.current.messages.at(-1)?.text).toMatch(/don't have a bundle/i);
    });

    it("replies without pinning anything when the theme isn't a preset", async () => {
      const { result } = renderChatSolve({ session: baseSession({ theme: { kind: "custom", text: "coastal" } }) });
      act(() => result.current.sendMessage("keep the toilet"));
      await flushMicrotasks();
      expect(result.current.pinnedBundle).toBeNull();
      expect(result.current.messages.at(-1)?.text).toMatch(/preset style/i);
    });
  });

  describe("swap-item", () => {
    it("swaps to the closest cheaper neighbor, not the cheapest overall", async () => {
      const { result } = renderChatSolve(); // toilet-mid (45000) is current
      act(() => result.current.sendMessage("swap the toilet for something cheaper"));
      await flushMicrotasks();
      expect(result.current.pinnedBundle?.items.toilet.productId).toBe("toilet-cheap");
    });

    it("swaps to the closest pricier neighbor", async () => {
      const { result } = renderChatSolve();
      act(() => result.current.sendMessage("make the toilet nicer"));
      await flushMicrotasks();
      expect(result.current.pinnedBundle?.items.toilet.productId).toBe("toilet-premium");
    });

    it("explains instead of erroring when already at the cheapest option", async () => {
      const solvedAtCheapest: IntakeSolveResult = {
        status: "solved",
        tiers: [makeBundle("value", "toilet-cheap"), makeBundle("balanced", "toilet-cheap"), makeBundle("premium", "toilet-cheap")],
      };
      const { result } = renderChatSolve({ solve: solvedAtCheapest });
      act(() => result.current.sendMessage("swap the toilet for something cheaper"));
      await flushMicrotasks();
      expect(result.current.pinnedBundle).toBeNull();
      expect(result.current.messages.at(-1)?.text).toMatch(/already the cheapest/i);
    });
  });

  describe("unrecognized", () => {
    it("gives a fallback reply and makes no engine call or session patch", async () => {
      const { result, patchSession } = renderChatSolve();
      act(() => result.current.sendMessage("what do you think of this room"));
      await flushMicrotasks();
      expect(patchSession).not.toHaveBeenCalled();
      expect(result.current.pinnedBundle).toBeNull();
      expect(result.current.messages.at(-1)?.role).toBe("assistant");
    });
  });

  it("echoes the user's own message before replying", () => {
    const { result } = renderChatSolve();
    act(() => result.current.sendMessage("hello"));
    expect(result.current.messages[0]).toMatchObject({ role: "user", text: "hello" });
  });
});
