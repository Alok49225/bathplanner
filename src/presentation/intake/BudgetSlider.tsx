import "./BudgetSlider.css";

export interface BudgetSliderProps {
  valueCents: number;
  onChange: (valueCents: number) => void;
  minCents?: number;
  maxCents?: number;
  stepCents?: number;
}

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function BudgetSlider({
  valueCents,
  onChange,
  minCents = 50_000,
  maxCents = 2_500_000,
  stepCents = 10_000,
}: BudgetSliderProps) {
  return (
    <div className="budget-slider">
      <div className="budget-slider-header">
        <label htmlFor="budget-slider-input">Budget</label>
        <span className="budget-slider-value">{currencyFormatter.format(valueCents / 100)}</span>
      </div>
      <input
        id="budget-slider-input"
        type="range"
        min={minCents}
        max={maxCents}
        step={stepCents}
        value={valueCents}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-valuetext={currencyFormatter.format(valueCents / 100)}
      />
    </div>
  );
}
