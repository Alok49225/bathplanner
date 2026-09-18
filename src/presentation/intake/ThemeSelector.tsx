import { THEMES, THEME_LABELS } from "../../domain/types/product";
import type { ThemeSelection } from "../../domain/types/product";
import "./ThemeSelector.css";

// Re-exported so existing imports of ThemeSelection from this file keep working —
// the type itself now lives in domain/types/product.ts alongside Theme.
export type { ThemeSelection } from "../../domain/types/product";

export interface ThemeSelectorProps {
  value: ThemeSelection;
  onChange: (value: ThemeSelection) => void;
}

export function ThemeSelector({ value, onChange }: ThemeSelectorProps) {
  return (
    <fieldset className="theme-selector">
      <legend>Style</legend>

      {THEMES.map((theme) => (
        <label key={theme} className="theme-option">
          <input
            type="radio"
            name="theme"
            checked={value.kind === "preset" && value.theme === theme}
            onChange={() => onChange({ kind: "preset", theme })}
          />
          {THEME_LABELS[theme]}
        </label>
      ))}

      <label className="theme-option">
        <input
          type="radio"
          name="theme"
          checked={value.kind === "custom"}
          onChange={() => onChange({ kind: "custom", text: value.kind === "custom" ? value.text : "" })}
        />
        Custom
      </label>

      {value.kind === "custom" && (
        <input
          type="text"
          className="theme-custom-text"
          placeholder="Describe the style you want"
          value={value.text}
          onChange={(e) => onChange({ kind: "custom", text: e.target.value })}
        />
      )}
    </fieldset>
  );
}
