/**
 * Clearance/fit validator — checks candidate floor-fixture placements
 * against room bounds, code clearances, and each other. Only toilet,
 * vanity, and shower are floor fixtures with a plumbing rough-in; faucet
 * and lighting mount on/above another fixture and have no independent
 * placement to validate.
 *
 * Geometry is a documented simplification: Room carries no true CAD data,
 * so "position" is treated as the fixture's back-corner nearest its wall,
 * "width" runs along the wall, "depth" runs away from it, and clearance
 * only extends away from the wall (never through it) plus symmetrically
 * to both sides. It catches the two failure modes that matter for the
 * demo — too close to a wall, too close to another fixture — without
 * modeling door swings or exact code geometry.
 */

import type { Product } from "../types/product";
import type { Room, Wall } from "../types/room";

export type FloorFixtureCategory = "toilet" | "vanity" | "shower";

export interface FloorFixturePlacement {
  category: FloorFixtureCategory;
  product: Product;
  plumbingPointId: string;
}

export interface FitIssue {
  severity: "error" | "warning";
  code: "no-plumbing-point" | "out-of-bounds" | "overlaps-fixture" | "insufficient-clearance";
  message: string;
  category: FloorFixtureCategory;
}

export interface Rect {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface Clearance {
  front: number;
  side: number;
}

const DEFAULT_CLEARANCE: Record<FloorFixtureCategory, Clearance> = {
  toilet: { front: 21, side: 15 },
  vanity: { front: 21, side: 6 },
  shower: { front: 24, side: 6 },
};

/** Exported for t24's clearance overlay — the same clearance a product actually gets validated against. */
export function resolveClearance(product: Product, category: FloorFixtureCategory): Clearance {
  const fallback = DEFAULT_CLEARANCE[category];
  return {
    front: product.clearanceOverride?.front ?? fallback.front,
    side: product.clearanceOverride?.side ?? fallback.side,
  };
}

/** Exported for t21's FixtureLayer — reused directly so the rectangle drawn on screen is pixel-identical to the one t7 actually validated, not a second independent computation. */
export function footprintRect(product: Product, position: { x: number; y: number }, wall: Wall): Rect {
  const { width, depth } = product.dimensions;
  switch (wall) {
    case "north":
      return { x1: position.x, y1: position.y, x2: position.x + width, y2: position.y + depth };
    case "south":
      return { x1: position.x, y1: position.y - depth, x2: position.x + width, y2: position.y };
    case "west":
      return { x1: position.x, y1: position.y, x2: position.x + depth, y2: position.y + width };
    case "east":
      return { x1: position.x - depth, y1: position.y, x2: position.x, y2: position.y + width };
  }
}

/** Exported for t24's clearance overlay — reused directly, same reasoning as footprintRect. */
export function clearanceRect(footprint: Rect, wall: Wall, clearance: Clearance): Rect {
  const { front, side } = clearance;
  switch (wall) {
    case "north":
      return { x1: footprint.x1 - side, y1: footprint.y1, x2: footprint.x2 + side, y2: footprint.y2 + front };
    case "south":
      return { x1: footprint.x1 - side, y1: footprint.y1 - front, x2: footprint.x2 + side, y2: footprint.y2 };
    case "west":
      return { x1: footprint.x1, y1: footprint.y1 - side, x2: footprint.x2 + front, y2: footprint.y2 + side };
    case "east":
      return { x1: footprint.x1 - front, y1: footprint.y1 - side, x2: footprint.x2, y2: footprint.y2 + side };
  }
}

function intersects(a: Rect, b: Rect): boolean {
  return a.x1 < b.x2 && a.x2 > b.x1 && a.y1 < b.y2 && a.y2 > b.y1;
}

function withinRoom(rect: Rect, room: Room): boolean {
  return rect.x1 >= 0 && rect.y1 >= 0 && rect.x2 <= room.widthIn && rect.y2 <= room.lengthIn;
}

/**
 * Coarse pre-filter for t4: does this product's footprint fit within the
 * room at any of its plumbing points for this category, regardless of what
 * else ends up in the bundle? Only checks the hard "out-of-bounds" failure
 * — a technically-valid-but-cramped fit is still allowed through here and
 * caught as a warning by validateFit later, matching the "tight-fit
 * warning, not silent rejection" behavior the blueprint asks for.
 */
export function canFit(product: Product, room: Room, category: FloorFixtureCategory): boolean {
  const points = room.plumbing.filter((p) => p.category === category);
  return points.some((point) => withinRoom(footprintRect(product, point.position, point.wall), room));
}

export function validateFit(placements: FloorFixturePlacement[], room: Room): FitIssue[] {
  const issues: FitIssue[] = [];

  const resolved = placements.map((placement) => {
    const point = room.plumbing.find(
      (p) => p.id === placement.plumbingPointId && p.category === placement.category
    );
    return { placement, point };
  });

  for (const { placement, point } of resolved) {
    if (!point) {
      issues.push({
        severity: "error",
        code: "no-plumbing-point",
        message: `No ${placement.category} rough-in found for this bundle.`,
        category: placement.category,
      });
    }
  }

  const placed = resolved.filter(
    (r): r is { placement: FloorFixturePlacement; point: NonNullable<typeof r.point> } => !!r.point
  );

  for (let i = 0; i < placed.length; i++) {
    const { placement, point } = placed[i];
    const clearance = resolveClearance(placement.product, placement.category);
    const footprint = footprintRect(placement.product, point.position, point.wall);
    const clearZone = clearanceRect(footprint, point.wall, clearance);

    if (!withinRoom(footprint, room)) {
      issues.push({
        severity: "error",
        code: "out-of-bounds",
        message: `${placement.category} doesn't fit within the room's footprint.`,
        category: placement.category,
      });
    }

    // Clear-zone-vs-room-bounds is checked once per placement, independent of
    // how many other fixtures exist (a lone fixture can still be too close
    // to the opposite wall).
    let flaggedClearance = !withinRoom(footprint, room) ? false : !withinRoom(clearZone, room);

    for (let j = 0; j < placed.length; j++) {
      if (i === j) continue;
      const other = placed[j];
      const otherFootprint = footprintRect(other.placement.product, other.point.position, other.point.wall);

      if (intersects(footprint, otherFootprint)) {
        issues.push({
          severity: "error",
          code: "overlaps-fixture",
          message: `${placement.category} physically overlaps ${other.placement.category}.`,
          category: placement.category,
        });
      } else if (intersects(clearZone, otherFootprint)) {
        flaggedClearance = true;
      }
    }

    if (flaggedClearance) {
      issues.push({
        severity: "warning",
        code: "insufficient-clearance",
        message: `${placement.category} has less than the recommended ${clearance.front}in front clearance.`,
        category: placement.category,
      });
    }
  }

  return issues;
}
