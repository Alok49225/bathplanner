import type { IntakeSolveResult } from "../../application/intake-orchestration";
import "./SolveStatusPanel.css";

export interface SolveStatusPanelProps {
  solve: IntakeSolveResult;
}

type Variant = "loading" | "empty" | "warning" | "error" | "success";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function variantFor(solve: IntakeSolveResult): Variant {
  switch (solve.status) {
    case "loading-catalog":
    case "solving":
      return "loading";
    case "catalog-error":
      return "error";
    case "no-preset-theme":
      return "empty";
    case "solved":
      return "success";
    case "infeasible":
      // "missing-plumbing-point" means the user just hasn't finished the
      // form yet — nothing is wrong, same as "no-preset-theme". The other
      // two reasons mean the form IS complete but the result doesn't work,
      // which is a warning, not an empty state.
      return solve.infeasibleReason === "missing-plumbing-point" ? "empty" : "warning";
  }
}

function Spinner() {
  return <span className="solve-status-spinner" aria-hidden="true" />;
}

function content(solve: IntakeSolveResult) {
  switch (solve.status) {
    case "loading-catalog":
      return (
        <>
          <Spinner />
          <span>Loading catalog…</span>
        </>
      );
    case "solving":
      return (
        <>
          <Spinner />
          <span>Solving…</span>
        </>
      );
    case "catalog-error":
      return <span>Couldn't load the catalog. Refresh to try again.</span>;
    case "no-preset-theme":
      return <span>Pick a preset style to see bundles (custom styles aren't matched to products yet).</span>;
    case "solved":
      return (
        <ul className="solve-status-tiers">
          {(solve.tiers ?? []).map((bundle) => (
            <li key={bundle.id}>
              {bundle.tier}: {currencyFormatter.format(bundle.totalPriceCents / 100)}
              {bundle.warnings.length > 0 &&
                ` (${bundle.warnings.length} warning${bundle.warnings.length > 1 ? "s" : ""})`}
            </li>
          ))}
        </ul>
      );
    case "infeasible":
      if (solve.infeasibleReason === "missing-plumbing-point") {
        return <span>Add a plumbing point for the toilet, vanity, and shower to see bundle options.</span>;
      }
      if (solve.infeasibleReason === "over-budget") {
        return (
          <span>
            Even the cheapest bundle costs {currencyFormatter.format((solve.cheapestPossibleCents ?? 0) / 100)} —
            over budget. Try raising it.
          </span>
        );
      }
      // "no-eligible-options"
      return (
        <span>
          {solve.issues && solve.issues.length > 0
            ? solve.issues.map((issue) => issue.message).join(" ")
            : "No products fit this room's constraints."}{" "}
          Try adjusting the room dimensions or removing a style constraint — no budget change will fix this.
        </span>
      );
  }
}

export function SolveStatusPanel({ solve }: SolveStatusPanelProps) {
  const variant = variantFor(solve);
  return (
    <div
      className={`solve-status-panel solve-status-panel-${variant}`}
      role={variant === "error" ? "alert" : "status"}
    >
      {content(solve)}
    </div>
  );
}
