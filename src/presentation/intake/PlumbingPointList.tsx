import type { PlumbingPoint, Wall } from "../../domain/types/room";
import "./ListEditor.css";

export interface PlumbingPointListProps {
  value: PlumbingPoint[];
  onChange: (points: PlumbingPoint[]) => void;
}

const WALLS: Wall[] = ["north", "south", "east", "west"];
const CATEGORIES: PlumbingPoint["category"][] = ["toilet", "vanity", "shower"];

function newPoint(): PlumbingPoint {
  return { id: `plumbing-${crypto.randomUUID()}`, category: "toilet", position: { x: 0, y: 0 }, wall: "south" };
}

export function PlumbingPointList({ value, onChange }: PlumbingPointListProps) {
  function updatePoint(id: string, patch: Partial<PlumbingPoint>) {
    onChange(value.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  return (
    <div className="list-editor">
      <div className="list-editor-header">
        <h4>Plumbing rough-ins</h4>
        <button type="button" onClick={() => onChange([...value, newPoint()])}>
          Add plumbing point
        </button>
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
              {CATEGORIES.map((c) => (
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
