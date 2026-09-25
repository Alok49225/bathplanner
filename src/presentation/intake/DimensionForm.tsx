import type { RoomDimensions } from "../../domain/types/room";
import type { Product } from "../../domain/types/product";
import { DoorList } from "./DoorList";
import { WindowList } from "./WindowList";
import { PlumbingPointList } from "./PlumbingPointList";
import type { AutoPlaceResult } from "./PlumbingPointList";
import "./DimensionForm.css";

// Re-exported so existing imports of RoomDimensions from this file keep working —
// the type itself now lives in domain/types/room.ts so Application-layer code
// (t18) can use it without depending upward on Presentation.
export type { RoomDimensions } from "../../domain/types/room";

export interface DimensionFormProps {
  value: RoomDimensions;
  onChange: (value: RoomDimensions) => void;
  /** Null while the catalog is still loading — threaded straight through to PlumbingPointList's auto-place button. */
  catalog: Product[] | null;
}

function feetAndInches(inches: number): string {
  const feet = Math.floor(inches / 12);
  const remainder = inches % 12;
  return `${inches} in ≈ ${feet}'${remainder}"`;
}

export function DimensionForm({ value, onChange, catalog }: DimensionFormProps) {
  function updateField<K extends keyof RoomDimensions>(key: K, fieldValue: RoomDimensions[K]) {
    onChange({ ...value, [key]: fieldValue });
  }

  // A manual plumbing edit means the user is hand-managing points again —
  // any earlier auto-placement's omissions are stale the moment that
  // happens, so they're cleared rather than silently kept around (see
  // RoomDimensions.omittedFixtures's own doc comment in room.ts).
  function handleManualPlumbingChange(plumbing: RoomDimensions["plumbing"]) {
    onChange({ ...value, plumbing, omittedFixtures: [] });
  }

  function handleAutoPlace(result: AutoPlaceResult) {
    onChange({ ...value, plumbing: result.plumbing, omittedFixtures: result.omittedFixtures });
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
      <PlumbingPointList
        value={value.plumbing}
        onChange={handleManualPlumbingChange}
        room={value}
        catalog={catalog}
        onAutoPlace={handleAutoPlace}
      />
    </div>
  );
}
