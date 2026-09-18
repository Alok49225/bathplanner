import type { Door, Wall } from "../../domain/types/room";
import "./ListEditor.css";

export interface DoorListProps {
  value: Door[];
  onChange: (doors: Door[]) => void;
}

const WALLS: Wall[] = ["north", "south", "east", "west"];

function newDoor(): Door {
  return { id: `door-${crypto.randomUUID()}`, wall: "south", offset: 0, widthIn: 28, swing: "right" };
}

export function DoorList({ value, onChange }: DoorListProps) {
  function updateDoor(id: string, patch: Partial<Door>) {
    onChange(value.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  }

  return (
    <div className="list-editor">
      <div className="list-editor-header">
        <h4>Doors</h4>
        <button type="button" onClick={() => onChange([...value, newDoor()])}>
          Add door
        </button>
      </div>
      {value.length === 0 && <p className="list-editor-empty">No doors added.</p>}
      {value.map((door) => (
        <div className="list-editor-row" key={door.id}>
          <label>
            Wall
            <select value={door.wall} onChange={(e) => updateDoor(door.id, { wall: e.target.value as Wall })}>
              {WALLS.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
          </label>
          <label>
            Offset (in)
            <input
              type="number"
              value={door.offset}
              onChange={(e) => updateDoor(door.id, { offset: Number(e.target.value) })}
            />
          </label>
          <label>
            Width (in)
            <input
              type="number"
              value={door.widthIn}
              onChange={(e) => updateDoor(door.id, { widthIn: Number(e.target.value) })}
            />
          </label>
          <label>
            Swing
            <select
              value={door.swing}
              onChange={(e) => updateDoor(door.id, { swing: e.target.value as Door["swing"] })}
            >
              <option value="left">left</option>
              <option value="right">right</option>
            </select>
          </label>
          <button type="button" onClick={() => onChange(value.filter((d) => d.id !== door.id))}>
            Remove
          </button>
        </div>
      ))}
    </div>
  );
}
