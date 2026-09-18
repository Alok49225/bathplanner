import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TierSwitcher } from "./TierSwitcher";
import type { Bundle, BundleLineItem, BundleTier } from "../../domain/types/bundle";
import type { ProductCategory } from "../../domain/types/product";

function makeItem(category: ProductCategory): BundleLineItem {
  return { category, productId: `${category}-1`, placement: { position: { x: 0, y: 0 } } };
}

function makeBundle(tier: BundleTier, totalPriceCents: number, warnings: string[] = []): Bundle {
  const categories: ProductCategory[] = ["toilet", "vanity", "faucet", "shower", "lighting"];
  const items = {} as Bundle["items"];
  categories.forEach((c) => (items[c] = makeItem(c)));
  return {
    id: `bundle-${tier}`,
    tier,
    items,
    totalPriceCents,
    budgetCents: 500000,
    warnings,
  };
}

function makeTiers(overrides: Partial<Record<BundleTier, Bundle>> = {}): [Bundle, Bundle, Bundle] {
  return [
    overrides.value ?? makeBundle("value", 300000),
    overrides.balanced ?? makeBundle("balanced", 400000),
    overrides.premium ?? makeBundle("premium", 500000),
  ];
}

describe("TierSwitcher", () => {
  it("renders one tab per tier with its label and formatted price", () => {
    render(<TierSwitcher tiers={makeTiers()} selectedTier="balanced" onChange={() => {}} />);
    expect(screen.getByRole("tab", { name: /Value/ })).toBeInTheDocument();
    expect(screen.getByText("$3,000")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Balanced/ })).toBeInTheDocument();
    expect(screen.getByText("$4,000")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Premium/ })).toBeInTheDocument();
    expect(screen.getByText("$5,000")).toBeInTheDocument();
  });

  it("marks exactly the selected tier's tab as aria-selected", () => {
    render(<TierSwitcher tiers={makeTiers()} selectedTier="premium" onChange={() => {}} />);
    expect(screen.getByRole("tab", { name: /Value/ })).toHaveAttribute("aria-selected", "false");
    expect(screen.getByRole("tab", { name: /Balanced/ })).toHaveAttribute("aria-selected", "false");
    expect(screen.getByRole("tab", { name: /Premium/ })).toHaveAttribute("aria-selected", "true");
  });

  it("calls onChange with the clicked tier", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<TierSwitcher tiers={makeTiers()} selectedTier="value" onChange={onChange} />);
    await user.click(screen.getByRole("tab", { name: /Premium/ }));
    expect(onChange).toHaveBeenCalledWith("premium");
  });

  it("calls onChange even when the already-selected tab is clicked, rather than swallowing the click", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<TierSwitcher tiers={makeTiers()} selectedTier="balanced" onChange={onChange} />);
    await user.click(screen.getByRole("tab", { name: /Balanced/ }));
    expect(onChange).toHaveBeenCalledWith("balanced");
  });

  it("shows a warning indicator only on tiers that actually have warnings", () => {
    const tiers = makeTiers({
      value: makeBundle("value", 300000, ["Tight clearance around the toilet."]),
    });
    render(<TierSwitcher tiers={tiers} selectedTier="value" onChange={() => {}} />);
    const valueTab = screen.getByRole("tab", { name: /Value/ });
    const balancedTab = screen.getByRole("tab", { name: /Balanced/ });
    expect(valueTab.querySelector(".tier-switcher-warning")).not.toBeNull();
    expect(balancedTab.querySelector(".tier-switcher-warning")).toBeNull();
  });
});
