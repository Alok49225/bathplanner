/**
 * Room & constraint schema — the shape of "the space to solve into."
 * Consumed by: the clearance/fit validator (t7), the 2D floor-plan
 * renderer (t20), and the intent parser (t26) for freeform constraints.
 */

/** Inches, measured from the room's top-left corner — (0,0) — looking down. */
export interface Point {
  x: number;
  y: number;
}

export type Wall = "north" | "south" | "east" | "west";

export interface Door {
  id: string;
  wall: Wall;
  /** Distance in inches from that wall's start corner to the door's near edge. */
  offset: number;
  widthIn: number;
  /** Which way the door swings into the room — shapes the clearance zone it occupies. */
  swing: "left" | "right";
}

export interface Window {
  id: string;
  wall: Wall;
  offset: number;
  widthIn: number;
  sillHeightIn: number;
}

/**
 * A fixed plumbing rough-in the solver must place the matching category's
 * fixture at (or immediately adjacent to) — moving these is out of scope
 * (see Blueprint §08, "Structural / plumbing relocation planning").
 */
export interface PlumbingPoint {
  id: string;
  category: "toilet" | "vanity" | "shower";
  position: Point;
  /** The wall the fixture backs onto — gives clearance a "front" direction and gives the floor-plan renderer (t20) the fixture's facing. */
  wall: Wall;
}

export interface AccessibilityFlags {
  curblessShower?: boolean;
  grabBarZones?: boolean;
  loweredVanity?: boolean;
}

/**
 * A structured requirement parsed from freeform intake notes or chat
 * (t26 produces these; this schema just defines the shape they land in).
 */
export interface Constraint {
  id: string;
  strength: "hard" | "soft";
  /** Plain-language form, shown back to the user so a rejected bundle can explain why. */
  description: string;
  /** Machine-readable form the solver actually checks. */
  rule:
    | { type: "keep-fixture"; category: import("./product").ProductCategory }
    | { type: "must-include-tag"; tag: string }
    | { type: "avoid-tag"; tag: string }
    | { type: "max-install-complexity"; level: "drop-in" | "standard" | "specialist" };
}

export interface Room {
  widthIn: number;
  lengthIn: number;
  ceilingHeightIn: number;
  doors: Door[];
  windows: Window[];
  plumbing: PlumbingPoint[];
  accessibility: AccessibilityFlags;
  constraints: Constraint[];
}

/**
 * The subset of Room the dimension form (t14) actually collects — excludes
 * accessibility/constraints, which belong to other intake pieces. Also
 * carries `omittedFixtures`, session-only bookkeeping for the auto-placement
 * fallback ladder (placement-solver.ts) — which floor categories it
 * deliberately left out, so intake-orchestration.ts can forward that to
 * generateTiers's own `omittedCategories` parameter. Not part of `Room`
 * itself: the engine takes omissions as an explicit function argument,
 * never reads them off the room. Any manual plumbing edit resets this to
 * `[]` (see DimensionForm.tsx) — it's stale the moment the user starts
 * hand-managing points again.
 */
export type RoomDimensions = Pick<Room, "widthIn" | "lengthIn" | "ceilingHeightIn" | "doors" | "windows" | "plumbing"> & {
  omittedFixtures?: PlumbingPoint["category"][];
};
