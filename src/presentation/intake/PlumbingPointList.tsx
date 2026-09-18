import { useState } from "react";
import type { RoomDimensions, PlumbingPoint, Wall, Point } from "../../domain/types/room";
import { FloorPlan } from "../viz/FloorPlan";
import "./ListEditor.css";
import "./PlumbingPointList.css";

export interface PlumbingPointListProps {
  value: PlumbingPoint[];
  onChange: (points: PlumbingPoint[]) => void;
  /** Needed to render the click-to-place floor plan — the list itself still only ever reads/writes `value`. */
  room: RoomDimensions;
}

const WALLS: Wall[] = ["north", "south", "east", "west"];
const CATEGORIES: PlumbingPoint["category"][] = ["toilet", "vanity", "shower"];
const CATEGORY_LABELS: Record<PlumbingPoint["category"], string> = {
  toilet: "Toilet",
  vanity: "Vanity",
  shower: "Shower",
};

function newPoint(category: PlumbingPoint["category"]): PlumbingPoint {
  return { id: `plumbing-${crypto.randomUUID()}`, category, position: { x: 0, y: 0 }, wall: "south" };
}

/**
 * The engine only ever reads the first point per category
 * (tier-generator's resolvePlumbingPoints does room.plumbing.find(...)), so
 * a second point for a category already present isn't a second fixture —
 * it's inert data nothing reads, and its Remove button is the only thing
 * about it a user can actually "control". Used both to pick a sane default
 * for the Add button and to keep each row's own Category dropdown from
 * letting a manual edit create the same problem.
 */
function unusedCategories(value: PlumbingPoint[], keep?: PlumbingPoint["category"]): PlumbingPoint["category"][] {
  return CATEGORIES.filter((c) => c === keep || !value.some((p) => p.category === c));
}

/**
 * A click only gives us {x, y} — `wall` isn't decorative (t7's fit validator
 * uses it as the clearance "front" direction), so a placed point still needs
 * one. Inferring the nearest room edge is a reasonable default a user can
 * still override with the existing Wall dropdown below.
 */
function nearestWall(position: Point, room: RoomDimensions): Wall {
  const distances: Record<Wall, number> = {
    north: position.y,
    south: room.lengthIn - position.y,
    west: position.x,
    east: room.widthIn - position.x,
  };
  return (Object.keys(distances) as Wall[]).reduce((closest, wall) =>
    distances[wall] < distances[closest] ? wall : closest
  );
}

export function PlumbingPointList({ value, onChange, room }: PlumbingPointListProps) {
  const [selectedCategory, setSelectedCategory] = useState<PlumbingPoint["category"] | null>(null);
  const [nextCategory] = unusedCategories(value);

  function updatePoint(id: string, patch: Partial<PlumbingPoint>) {
    onChange(value.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  // Clicking again for a category that already has a point moves that same
  // point rather than adding a duplicate — the engine only ever looks up
  // the first point per category anyway (resolvePlumbingPoints), so a
  // second point for the same category would just be silently ignored data.
  function handlePlace(category: PlumbingPoint["category"], position: Point) {
    const existing = value.find((p) => p.category === category);
    if (existing) {
      updatePoint(existing.id, { position });
    } else {
      onChange([...value, { id: `plumbing-${crypto.randomUUID()}`, category, position, wall: nearestWall(position, room) }]);
    }
  }

  return (
    <div className="list-editor">
      <div className="list-editor-header">
        <h4>Plumbing rough-ins</h4>
        <button
          type="button"
          disabled={!nextCategory}
          title={nextCategory ? undefined : "Toilet, vanity, and shower are all already added."}
          onClick={() => nextCategory && onChange([...value, newPoint(nextCategory)])}
        >
          Add plumbing point
        </button>
      </div>

      <div className="plumbing-placer">
        <div className="plumbing-placer-categories" role="radiogroup" aria-label="Category to place">
          {CATEGORIES.map((category) => (
            <button
              key={category}
              type="button"
              role="radio"
              aria-checked={selectedCategory === category}
              className={`plumbing-placer-category${selectedCategory === category ? " plumbing-placer-category-selected" : ""}`}
              onClick={() => setSelectedCategory(selectedCategory === category ? null : category)}
            >
              {CATEGORY_LABELS[category]}
            </button>
          ))}
        </div>
        <FloorPlan room={{ ...room, plumbing: value }} selectedCategory={selectedCategory} onPlumbingPointPlace={handlePlace} />
        <p className="plumbing-placer-hint">
          {selectedCategory
            ? `Click on the floor plan to place the ${CATEGORY_LABELS[selectedCategory].toLowerCase()}.`
            : "Select a category above, then click on the floor plan to place it."}
        </p>
      </div>

      {value.length === 0 && <p className="list-editor-empty">No plumbing points added.</p>}
      {value.map((point) => (
        <div className="list-editor-row" key={point.id}>
          <label>
            Category
            <select
              value={point.category}
              onChange={(e) => updatePoint(point.id, { category: e.target.value as PlumbingPoint["category"] })}
            >
              {unusedCategories(value, point.category).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label>
            Wall
            <select value={point.wall} onChange={(e) => updatePoint(point.id, { wall: e.target.value as Wall })}>
              {WALLS.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
          </label>
          <label>
            X (in)
            <input
              type="number"
              value={point.position.x}
              onChange={(e) =>
                updatePoint(point.id, { position: { ...point.position, x: Number(e.target.value) } })
              }
            />
          </label>
          <label>
            Y (in)
            <input
              type="number"
              value={point.position.y}
              onChange={(e) =>
                updatePoint(point.id, { position: { ...point.position, y: Number(e.target.value) } })
              }
            />
          </label>
          <button type="button" onClick={() => onChange(value.filter((p) => p.id !== point.id))}>
            Remove
          </button>
        </div>
      ))}
    </div>
  );
}
