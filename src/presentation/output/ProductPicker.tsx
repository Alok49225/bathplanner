import { useMemo } from "react";
import type { Product, ProductCategory } from "../../domain/types/product";
import "./ProductPicker.css";

export interface ProductPickerProps {
  category: ProductCategory;
  /** The category's full eligible list (compatibility-rules.ts's filterEligibleProducts) — not pre-filtered by budget, see the component's own doc comment. */
  products: Product[];
  selectedProductId: string;
  onSelect: (productId: string) => void;
  onClose: () => void;
}

// Same five labels FixtureLayer/BundleSummary already keep as their own
// local copy rather than a shared export — established precedent, not a
// new one.
const CATEGORY_LABELS: Record<ProductCategory, string> = {
  toilet: "Toilet",
  vanity: "Vanity",
  faucet: "Faucet",
  shower: "Shower",
  lighting: "Lighting",
};

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

/**
 * Deliberately doesn't pre-filter or badge options by whether they'd keep
 * the bundle within budget — Select reuses the exact same pinAndResolve
 * path chat's "keep the X" already does, which already reports over-budget
 * gracefully if a particular pick doesn't fit. Each row's own price is
 * visible next to the remaining-budget figure already shown in
 * BundleSummary, so the user can judge that themselves before picking.
 */
export function ProductPicker({ category, products, selectedProductId, onSelect, onClose }: ProductPickerProps) {
  const sorted = useMemo(() => [...products].sort((a, b) => a.priceCents - b.priceCents), [products]);

  return (
    <div className="product-picker-backdrop" onClick={onClose}>
      <div
        className="product-picker"
        role="dialog"
        aria-label={`Choose a ${CATEGORY_LABELS[category]}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="product-picker-header">
          <h4>Choose a {CATEGORY_LABELS[category]}</h4>
          <button type="button" className="product-picker-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <ul className="product-picker-list">
          {sorted.map((product) => {
            const isSelected = product.id === selectedProductId;
            return (
              <li key={product.id} className="product-picker-row">
                <span className="product-picker-row-info">
                  <span className="product-picker-row-name">
                    {product.name} · {product.brand}, {product.finish}
                  </span>
                  <span className="product-picker-row-price">
                    {currencyFormatter.format(product.priceCents / 100)}
                  </span>
                </span>
                {isSelected ? (
                  <span className="product-picker-row-selected">Selected</span>
                ) : (
                  <button type="button" onClick={() => onSelect(product.id)}>
                    Select
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
