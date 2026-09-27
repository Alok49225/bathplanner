import { useEffect, useMemo, useRef } from "react";
import type { Product, ProductCategory } from "../../domain/types/product";
import "./ProductPicker.css";

const FOCUSABLE_SELECTOR = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

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
  const dialogRef = useRef<HTMLDivElement>(null);
  // App.tsx passes a fresh inline onClose every render — kept in a ref so
  // the mount-effect below can always call the latest one without needing
  // to re-run its setup (and re-capture "what was focused before") on
  // every re-render, only on genuine mount/unmount.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Runs exactly once per open/close cycle — this component only ever
  // exists while a category's picker is actually open (App.tsx renders it
  // conditionally), so mount == open and unmount == close. Moves focus into
  // the dialog immediately, restores it to whatever triggered the open
  // (the "Change" button) once closed, and traps Tab/Shift+Tab inside the
  // dialog so keyboard focus can't silently escape to the page underneath
  // while a modal is up.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab" || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
    };
  }, []);

  return (
    <div className="product-picker-backdrop" onClick={onClose}>
      <div
        ref={dialogRef}
        className="product-picker"
        role="dialog"
        aria-modal="true"
        aria-label={`Choose a ${CATEGORY_LABELS[category]}`}
        tabIndex={-1}
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
