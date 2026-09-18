import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SolveStatusPanel } from "./SolveStatusPanel";
import type { IntakeSolveResult } from "../../application/intake-orchestration";
import type { Bundle, BundleLineItem, BundleTier } from "../../domain/types/bundle";
import type { ProductCategory } from "../../domain/types/product";

function makeItem(category: ProductCategory): BundleLineItem {
  return { category, productId: `${category}-1`, placement: { position: { x: 0, y: 0 } } };
}

function makeBundle(tier: BundleTier, totalPriceCents: number, warnings: string[] = []): Bundle {
  const categories: ProductCategory[] = ["toilet", "vanity", "faucet", "shower", "lighting"];
  const items = {} as Bundle["items"];
  categories.forEach((c) => (items[c] = makeItem(c)));
  return { id: `bundle-${tier}`, tier, items, totalPriceCents, budgetCents: 500000, warnings };
}

function variantOf(container: HTMLElement): string {
  const panel = container.querySelector(".solve-status-panel")!;
  const variantClass = Array.from(panel.classList).find((c) => c.startsWith("solve-status-panel-"));
  return variantClass!.replace("solve-status-panel-", "");
}

describe("SolveStatusPanel", () => {
  it("shows a loading treatment with the catalog message while the catalog loads", () => {
    const solve: IntakeSolveResult = { status: "loading-catalog" };
    const { container } = render(<SolveStatusPanel solve={solve} />);
    expect(variantOf(container)).toBe("loading");
    expect(screen.getByText("Loading catalog…")).toBeInTheDocument();
  });

  it("shows a loading treatment while re-solving", () => {
    const solve: IntakeSolveResult = { status: "solving" };
    const { container } = render(<SolveStatusPanel solve={solve} />);
    expect(variantOf(container)).toBe("loading");
    expect(screen.getByText("Solving…")).toBeInTheDocument();
  });

  it("shows an error treatment when the catalog fails to load", () => {
    const solve: IntakeSolveResult = { status: "catalog-error" };
    const { container } = render(<SolveStatusPanel solve={solve} />);
    expect(variantOf(container)).toBe("error");
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(/Couldn't load the catalog/)).toBeInTheDocument();
  });

  it("shows an empty treatment (not an error) when no preset theme is picked yet", () => {
    const solve: IntakeSolveResult = { status: "no-preset-theme" };
    const { container } = render(<SolveStatusPanel solve={solve} />);
    expect(variantOf(container)).toBe("empty");
    expect(screen.getByText(/Pick a preset style/)).toBeInTheDocument();
  });

  it("shows an empty treatment (not a warning) when a plumbing point is missing", () => {
    const solve: IntakeSolveResult = { status: "infeasible", infeasibleReason: "missing-plumbing-point" };
    const { container } = render(<SolveStatusPanel solve={solve} />);
    expect(variantOf(container)).toBe("empty");
    expect(screen.getByText(/Add a plumbing point/)).toBeInTheDocument();
  });

  it("shows a warning treatment with the real dollar shortfall when over budget", () => {
    const solve: IntakeSolveResult = {
      status: "infeasible",
      infeasibleReason: "over-budget",
      cheapestPossibleCents: 170600,
    };
    const { container } = render(<SolveStatusPanel solve={solve} />);
    expect(variantOf(container)).toBe("warning");
    expect(screen.getByText(/\$1,706/)).toBeInTheDocument();
    expect(screen.getByText(/Try raising it/)).toBeInTheDocument();
  });

  it("shows a warning treatment with the real per-category issue message when nothing fits", () => {
    const solve: IntakeSolveResult = {
      status: "infeasible",
      infeasibleReason: "no-eligible-options",
      issues: [
        {
          severity: "error",
          code: "category-unavailable",
          message: "No vanity products remain after applying the room's constraints.",
          categories: ["vanity"],
        },
      ],
    };
    const { container } = render(<SolveStatusPanel solve={solve} />);
    expect(variantOf(container)).toBe("warning");
    expect(screen.getByText(/No vanity products remain/)).toBeInTheDocument();
    expect(screen.getByText(/no budget change will fix this/)).toBeInTheDocument();
  });

  it("shows a success treatment listing every solved tier", () => {
    const solve: IntakeSolveResult = {
      status: "solved",
      tiers: [makeBundle("value", 300000), makeBundle("balanced", 400000, ["Tight clearance."]), makeBundle("premium", 500000)],
    };
    const { container } = render(<SolveStatusPanel solve={solve} />);
    expect(variantOf(container)).toBe("success");
    expect(screen.getByText(/value: \$3,000/)).toBeInTheDocument();
    expect(screen.getByText(/balanced: \$4,000 \(1 warning\)/)).toBeInTheDocument();
    expect(screen.getByText(/premium: \$5,000/)).toBeInTheDocument();
  });
});
