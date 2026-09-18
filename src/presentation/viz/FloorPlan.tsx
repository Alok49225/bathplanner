import type { MouseEvent as ReactMouseEvent } from "react";
import type { RoomDimensions, Wall, PlumbingPoint, Point } from "../../domain/types/room";
import "./FloorPlan.css";

export interface FloorPlanProps {
  room: RoomDimensions;
  /**
   * Set false when composing alongside FixtureLayer once a bundle exists —
   * FixtureLayer's legend is a strict superset (5 categories vs. these 3
   * plumbing-only ones), so showing both stacks two overlapping legends.
   * Defaults true so FloorPlan alone (no bundle yet) still explains its dots.
   */
  showLegend?: boolean;
  /**
   * The category a click should place, or null/undefined when placement
   * mode is off. FloorPlan stays presentational either way — it never reads
   * or writes Room state itself; it only reports "the user clicked here,"
   * echoing the category back so the caller doesn't need to worry about it
   * changing between the click and the callback firing.
   */
  selectedCategory?: PlumbingPoint["category"] | null;
  onPlumbingPointPlace?: (category: PlumbingPoint["category"], position: Point) => void;
}

interface Vec {
  x: number;
  y: number;
}

/**
 * Direction of increasing `offset` along each wall, and the direction
 * "into the room" from each wall — the same inward convention t7's
 * fit-validator already uses for fixture placement, reused here so a room
 * drawn by t20 and validated by t7 agree on which way is which.
 */
const ALONG: Record<Wall, Vec> = {
  north: { x: 1, y: 0 },
  south: { x: 1, y: 0 },
  west: { x: 0, y: 1 },
  east: { x: 0, y: 1 },
};
const INWARD: Record<Wall, Vec> = {
  north: { x: 0, y: 1 },
  south: { x: 0, y: -1 },
  west: { x: 1, y: 0 },
  east: { x: -1, y: 0 },
};

function wallBase(wall: Wall, room: RoomDimensions): Vec {
  switch (wall) {
    case "north":
      return { x: 0, y: 0 };
    case "south":
      return { x: 0, y: room.lengthIn };
    case "west":
      return { x: 0, y: 0 };
    case "east":
      return { x: room.widthIn, y: 0 };
  }
}

function wallLength(wall: Wall, room: RoomDimensions): number {
  return wall === "north" || wall === "south" ? room.widthIn : room.lengthIn;
}

function add(a: Vec, b: Vec, scale = 1): Vec {
  return { x: a.x + b.x * scale, y: a.y + b.y * scale };
}

interface Opening {
  start: number;
  end: number;
}

/** The solid wall segments remaining once every opening on that wall is cut out. */
function wallSegments(length: number, openings: Opening[]): [number, number][] {
  const sorted = [...openings].sort((a, b) => a.start - b.start);
  const segments: [number, number][] = [];
  let cursor = 0;
  for (const o of sorted) {
    if (o.start > cursor) segments.push([cursor, o.start]);
    cursor = Math.max(cursor, o.end);
  }
  if (cursor < length) segments.push([cursor, length]);
  return segments;
}

const WALLS: Wall[] = ["north", "south", "east", "west"];
const SCALE_BAR_LENGTH = 12; // inches — 1 foot
const SCALE_BAR_MARGIN = 6; // inches, inset from the room's south/east walls

const PLUMBING_CATEGORY_LABELS: Record<PlumbingPoint["category"], string> = {
  toilet: "Toilet",
  vanity: "Vanity",
  shower: "Shower",
};

export function FloorPlan({ room, showLegend = true, selectedCategory, onPlumbingPointPlace }: FloorPlanProps) {
  const openingsByWall: Record<Wall, Opening[]> = { north: [], south: [], east: [], west: [] };
  room.doors.forEach((d) => openingsByWall[d.wall].push({ start: d.offset, end: d.offset + d.widthIn }));
  room.windows.forEach((w) => openingsByWall[w.wall].push({ start: w.offset, end: w.offset + w.widthIn }));

  const plumbingCategoriesPresent = [...new Set(room.plumbing.map((p) => p.category))];

  function handleClick(e: ReactMouseEvent<SVGSVGElement>) {
    if (!selectedCategory || !onPlumbingPointPlace) return;

    // Convert the click from screen pixels into the SVG's own user-space
    // coordinates (which the viewBox makes exactly 1 unit = 1 inch) via the
    // SVG's actual screen transform, not a manual bounding-box ratio — this
    // stays correct regardless of how the SVG is scaled/displayed.
    const svg = e.currentTarget;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const screenPoint = svg.createSVGPoint();
    screenPoint.x = e.clientX;
    screenPoint.y = e.clientY;
    const roomPoint = screenPoint.matrixTransform(ctm.inverse());

    onPlumbingPointPlace(selectedCategory, {
      x: Math.max(0, Math.min(room.widthIn, roomPoint.x)),
      y: Math.max(0, Math.min(room.lengthIn, roomPoint.y)),
    });
  }

  return (
    <div className="floor-plan-container">
    <svg
      className={`floor-plan${selectedCategory ? " floor-plan-placing" : ""}`}
      viewBox={`0 0 ${room.widthIn} ${room.lengthIn}`}
      role="img"
      aria-label={`Floor plan, ${room.widthIn} by ${room.lengthIn} inches`}
      onClick={handleClick}
    >
      {WALLS.map((wall) => {
        const base = wallBase(wall, room);
        const along = ALONG[wall];
        const length = wallLength(wall, room);
        return wallSegments(length, openingsByWall[wall]).map(([s, e], i) => {
          const p1 = add(base, along, s);
          const p2 = add(base, along, e);
          return (
            <line
              key={`${wall}-wall-${i}`}
              className="floor-plan-wall"
              x1={p1.x}
              y1={p1.y}
              x2={p2.x}
              y2={p2.y}
            />
          );
        });
      })}

      {room.doors.map((door) => {
        const base = wallBase(door.wall, room);
        const along = ALONG[door.wall];
        const inward = INWARD[door.wall];
        const p0 = add(base, along, door.offset);
        const p1 = add(base, along, door.offset + door.widthIn);
        const hinge = door.swing === "left" ? p0 : p1;
        const otherJamb = door.swing === "left" ? p1 : p0;
        const openPoint = add(hinge, inward, door.widthIn);
        const cross =
          (otherJamb.x - hinge.x) * (openPoint.y - hinge.y) - (otherJamb.y - hinge.y) * (openPoint.x - hinge.x);
        const sweepFlag = cross > 0 ? 1 : 0;
        return (
          <g key={door.id} className="floor-plan-door" data-testid={`door-${door.id}`}>
            <line x1={hinge.x} y1={hinge.y} x2={openPoint.x} y2={openPoint.y} />
            <path
              d={`M ${otherJamb.x} ${otherJamb.y} A ${door.widthIn} ${door.widthIn} 0 0 ${sweepFlag} ${openPoint.x} ${openPoint.y}`}
              fill="none"
            />
          </g>
        );
      })}

      {room.windows.map((win) => {
        const base = wallBase(win.wall, room);
        const along = ALONG[win.wall];
        const inward = INWARD[win.wall];
        const p0 = add(base, along, win.offset);
        const p1 = add(base, along, win.offset + win.widthIn);
        const tickLength = Math.min(4, win.widthIn / 4);
        return (
          <g key={win.id} className="floor-plan-window" data-testid={`window-${win.id}`}>
            <line x1={p0.x} y1={p0.y} x2={p1.x} y2={p1.y} />
            {/* Jamb ticks — a plain colored line on the wall reads too weakly as "window"
                next to the door's clear swing-arc glyph, so mark both ends explicitly. */}
            <line x1={p0.x} y1={p0.y} x2={p0.x + inward.x * tickLength} y2={p0.y + inward.y * tickLength} />
            <line x1={p1.x} y1={p1.y} x2={p1.x + inward.x * tickLength} y2={p1.y + inward.y * tickLength} />
          </g>
        );
      })}

      {room.plumbing.map((point) => (
        <circle
          key={point.id}
          className={`floor-plan-plumbing floor-plan-plumbing-${point.category}`}
          data-testid={`plumbing-${point.id}`}
          cx={point.position.x}
          cy={point.position.y}
          r={2}
        >
          <title>{point.category} rough-in</title>
        </circle>
      ))}

      {(() => {
        const x2 = room.widthIn - SCALE_BAR_MARGIN;
        const x1 = x2 - SCALE_BAR_LENGTH;
        const y = room.lengthIn - SCALE_BAR_MARGIN;
        const tick = 1.5;
        return (
          <g className="floor-plan-scale" data-testid="floor-plan-scale">
            <line x1={x1} y1={y} x2={x2} y2={y} />
            <line x1={x1} y1={y - tick} x2={x1} y2={y + tick} />
            <line x1={x2} y1={y - tick} x2={x2} y2={y + tick} />
            <text x={(x1 + x2) / 2} y={y - tick - 1} textAnchor="middle">
              1 ft
            </text>
          </g>
        );
      })()}
    </svg>
    {showLegend && plumbingCategoriesPresent.length > 0 && (
      <div className="floor-plan-legend">
        {plumbingCategoriesPresent.map((category) => (
          <span key={category} className="floor-plan-legend-item">
            <span className={`floor-plan-legend-dot floor-plan-plumbing-${category}`} />
            {PLUMBING_CATEGORY_LABELS[category]}
          </span>
        ))}
      </div>
    )}
    </div>
  );
}
