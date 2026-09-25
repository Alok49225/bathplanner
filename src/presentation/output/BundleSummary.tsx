import { PRODUCT_CATEGORIES } from "../../domain/types/product";
import type { Product, ProductCategory } from "../../domain/types/product";
import type { Bundle } from "../../domain/types/bundle";
import "./BundleSummary.css";

export interface BundleSummaryProps {
  bundle: Bundle;
  catalog: Product[];
  /** Omitted entirely by ShareableExport.tsx's print view, which has nothing to click — the Change button only renders when this is actually provided. */
  onChangeCategory?: (category: ProductCategory) => void;
}

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

// Same labels FixtureLayer's legend already uses for these five categories —
// kept as its own local copy rather than a shared export, same precedent as
// FloorPlan's PLUMBING_CATEGORY_LABELS and FixtureLayer's own CATEGORY_LABELS.
const CATEGORY_LABELS: Record<ProductCategory, string> = {
  toilet: "Toilet",
  vanity: "Vanity",
  faucet: "Faucet",
  shower: "Shower",
  lighting: "Lighting",
};

function resolveProduct(catalog: Product[], productId: string): Product | undefined {
  return catalog.find((p) => p.id === productId);
}

/**
 * Which categories can go missing, and why, is fully determined by the
 * fixed fallback ladder (placement-solver.ts): vanity drops first, then
 * shower — toilet is never omitted, since the ladder fails outright rather
 * than building a bundle without one. Faucet/lighting have no independent
 * plumbing point, so they're only ever missing as vanity's cascade.
 */
function omissionReason(category: ProductCategory): string {
  switch (category) {
    case "vanity":
    case "shower":
      return `${CATEGORY_LABELS[category]} not included — the room wasn't big enough to fit one after prioritizing the other fixtures.`;
    case "faucet":
    case "lighting":
      return `${CATEGORY_LABELS[category]} not included — it mounts to the vanity, and there's no vanity in this room's layout.`;
    case "toilet":
      return `${CATEGORY_LABELS[category]} not included.`;
  }
}

export function BundleSummary({ bundle, catalog, onChangeCategory }: BundleSummaryProps) {
  const remainingCents = bundle.budgetCents - bundle.totalPriceCents;

  return (
    <div className="bundle-summary">
      <ul className="bundle-summary-items">
        {PRODUCT_CATEGORIES.map((category) => {
          const item = bundle.items[category];
          if (!item) {
            return (
              <li key={category} className="bundle-summary-item bundle-summary-item-omitted">
                <span className="bundle-summary-item-category">{CATEGORY_LABELS[category]}</span>
                <p className="bundle-summary-item-omitted-reason">{omissionReason(category)}</p>
              </li>
            );
          }
          const product = resolveProduct(catalog, item.productId);

          return (
            <li key={category} className="bundle-summary-item">
              <div className="bundle-summary-item-top">
                <span className="bundle-summary-item-label">
                  <span className="bundle-summary-item-category">{CATEGORY_LABELS[category]}</span>
                  <span className="bundle-summary-item-name">
                    {product ? `${product.name} · ${product.brand}, ${product.finish}` : item.productId}
                  </span>
                </span>
                <span className="bundle-summary-item-actions">
                  <span className="bundle-summary-item-price">
                    {product ? currencyFormatter.format(product.priceCents / 100) : "—"}
                  </span>
                  {onChangeCategory && (
                    <button
                      type="button"
                      className="bundle-summary-item-change"
                      onClick={() => onChangeCategory(category)}
                    >
                      Change
                    </button>
                  )}
                </span>
              </div>
              <p className="bundle-summary-item-rationale">{item.rationale ?? "—"}</p>
            </li>
          );
        })}
      </ul>

      <div className="bundle-summary-total">
        <span>
          Total: <strong>{currencyFormatter.format(bundle.totalPriceCents / 100)}</strong> of{" "}
          {currencyFormatter.format(bundle.budgetCents / 100)} budget
        </span>
        <span className="bundle-summary-remaining">
          {remainingCents >= 0
            ? `${currencyFormatter.format(remainingCents / 100)} remaining`
            : `${currencyFormatter.format(-remainingCents / 100)} over`}
        </span>
      </div>

      {typeof bundle.sustainabilityScore === "number" && (
        <div className="bundle-summary-sustainability">
          Water efficiency: <strong>{Math.round(bundle.sustainabilityScore * 100)}%</strong>
        </div>
      )}

      {bundle.warnings.length > 0 && (
        <ul className="bundle-summary-warnings">
          {bundle.warnings.map((warning, i) => (
            <li key={i}>{warning}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
