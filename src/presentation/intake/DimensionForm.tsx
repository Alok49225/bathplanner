import type { RoomDimensions } from "../../domain/types/room";
import { DoorList } from "./DoorList";
import { WindowList } from "./WindowList";
import { PlumbingPointList } from "./PlumbingPointList";
import "./DimensionForm.css";

// Re-exported so existing imports of RoomDimensions from this file keep working —
// the type itself now lives in domain/types/room.ts so Application-layer code
// (t18) can use it without depending upward on Presentation.
export type { RoomDimensions } from "../../domain/types/room";

export interface DimensionFormProps {
  value: RoomDimensions;
  onChange: (value: RoomDimensions) => void;
}

function feetAndInches(inches: number): string {
  const feet = Math.floor(inches / 12);
  const remainder = inches % 12;
  return `${inches} in ≈ ${feet}'${remainder}"`;
}

export function DimensionForm({ value, onChange }: DimensionFormProps) {
  function updateField<K extends keyof RoomDimensions>(key: K, fieldValue: RoomDimensions[K]) {
    onChange({ ...value, [key]: fieldValue });
  }

  return (
    <div className="dimension-form">
      <div className="dimension-fields">
        <div className="dimension-field">
          <label htmlFor="dim-width">Width (in)</label>
          <input
            id="dim-width"
            type="number"
            value={value.widthIn}
            onChange={(e) => updateField("widthIn", Number(e.target.value))}
          />
          <span className="dimension-hint">{feetAndInches(value.widthIn)}</span>
        </div>
        <div className="dimension-field">
          <label htmlFor="dim-length">Length (in)</label>
          <input
            id="dim-length"
            type="number"
            value={value.lengthIn}
            onChange={(e) => updateField("lengthIn", Number(e.target.value))}
          />
          <span className="dimension-hint">{feetAndInches(value.lengthIn)}</span>
        </div>
        <div className="dimension-field">
          <label htmlFor="dim-ceiling">Ceiling height (in)</label>
          <input
            id="dim-ceiling"
            type="number"
            value={value.ceilingHeightIn}
            onChange={(e) => updateField("ceilingHeightIn", Number(e.target.value))}
          />
          <span className="dimension-hint">{feetAndInches(value.ceilingHeightIn)}</span>
        </div>
      </div>

      <DoorList value={value.doors} onChange={(doors) => updateField("doors", doors)} />
      <WindowList value={value.windows} onChange={(windows) => updateField("windows", windows)} />
      <PlumbingPointList value={value.plumbing} onChange={(plumbing) => updateField("plumbing", plumbing)} room={value} />
    </div>
  );
}
