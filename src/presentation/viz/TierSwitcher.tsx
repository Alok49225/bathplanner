import type { Bundle, BundleTier } from "../../domain/types/bundle";
import "./TierSwitcher.css";

export interface TierSwitcherProps {
  tiers: [Bundle, Bundle, Bundle];
  selectedTier: BundleTier;
  onChange: (tier: BundleTier) => void;
}

const TIER_LABELS: Record<BundleTier, string> = {
  value: "Value",
  balanced: "Balanced",
  premium: "Premium",
};

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function TierSwitcher({ tiers, selectedTier, onChange }: TierSwitcherProps) {
  return (
    <div className="tier-switcher" role="tablist" aria-label="Bundle tier">
      {tiers.map((bundle) => {
        const isSelected = bundle.tier === selectedTier;
        return (
          <button
            key={bundle.tier}
            type="button"
            role="tab"
            aria-selected={isSelected}
            className={`tier-switcher-tab${isSelected ? " tier-switcher-tab-selected" : ""}`}
            onClick={() => onChange(bundle.tier)}
          >
            <span className="tier-switcher-label">{TIER_LABELS[bundle.tier]}</span>
            <span className="tier-switcher-price">{currencyFormatter.format(bundle.totalPriceCents / 100)}</span>
            {bundle.warnings.length > 0 && (
              <span className="tier-switcher-warning" title={bundle.warnings.join(" ")}>
                ⚠
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
