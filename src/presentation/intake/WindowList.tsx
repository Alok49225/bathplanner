import type { Window as RoomWindow, Wall } from "../../domain/types/room";
import "./ListEditor.css";

export interface WindowListProps {
  value: RoomWindow[];
  onChange: (windows: RoomWindow[]) => void;
}

const WALLS: Wall[] = ["north", "south", "east", "west"];

function newWindow(): RoomWindow {
  return { id: `window-${crypto.randomUUID()}`, wall: "north", offset: 0, widthIn: 24, sillHeightIn: 48 };
}

export function WindowList({ value, onChange }: WindowListProps) {
  function updateWindow(id: string, patch: Partial<RoomWindow>) {
    onChange(value.map((w) => (w.id === id ? { ...w, ...patch } : w)));
  }

  return (
    <div className="list-editor">
      <div className="list-editor-header">
        <h4>Windows</h4>
        <button type="button" onClick={() => onChange([...value, newWindow()])}>
          Add window
        </button>
      </div>
      {value.length === 0 && <p className="list-editor-empty">No windows added.</p>}
      {value.map((win) => (
        <div className="list-editor-row" key={win.id}>
          <label>
            Wall
            <select value={win.wall} onChange={(e) => updateWindow(win.id, { wall: e.target.value as Wall })}>
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
              value={win.offset}
              onChange={(e) => updateWindow(win.id, { offset: Number(e.target.value) })}
            />
          </label>
          <label>
            Width (in)
            <input
              type="number"
              value={win.widthIn}
              onChange={(e) => updateWindow(win.id, { widthIn: Number(e.target.value) })}
            />
          </label>
          <label>
            Sill height (in)
            <input
              type="number"
              value={win.sillHeightIn}
              onChange={(e) => updateWindow(win.id, { sillHeightIn: Number(e.target.value) })}
            />
          </label>
          <button type="button" onClick={() => onChange(value.filter((w) => w.id !== win.id))}>
            Remove
          </button>
        </div>
      ))}
    </div>
  );
}
