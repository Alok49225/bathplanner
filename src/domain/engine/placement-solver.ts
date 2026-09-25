/**
 * Automatic fixture placement — decides where toilet/vanity/shower plumbing
 * points go, instead of requiring the user to click or type them in. Built
 * as a deterministic search (candidate generation + scoring), not a live
 * model call — same reliability/testability reasoning as the rest of the
 * engine (see rationale-generator.ts, intent-parser.ts).
 */

import type { Product, Dimensions } from "../types/product";
import type { FloorFixtureCategory, Rect } from "./fit-validator";
import { footprintRect, clearanceRect, resolveClearance, intersects, withinRoom } from "./fit-validator";
import type { Room, Wall, Point } from "../types/room";

const WALLS: Wall[] = ["north", "south", "east", "west"];
const DEFAULT_STEP_IN = 2;

const CLEARANCE_SCORE_CLEAR = 1.0;
const CLEARANCE_SCORE_TIGHT = 0.4;
const WALL_SHARE_BONUS = 0.15;
const MAX_CORNER_BONUS = 0.1;

/**
 * Conservative worst-case footprint for a category, computed before any
 * specific product is chosen. Width and depth are maxed independently
 * across every SKU in the category (not "the single largest SKU's own
 * dimensions") so whatever product the budget selector later picks is
 * guaranteed to fit within the space reserved here.
 *
 * Real catalog quirk this accounts for: the `shower` category is mostly
 * small wall-mounted trim/valve hardware (a thermostatic valve trim is
 * 6x4in) with exactly one true floor-stall product ("Statement Curbless
 * Shower Base," 60x32in). Taking the max across the category reserves a
 * realistic shower-stall-sized footprint regardless of which specific SKU
 * is eventually chosen for that slot, rather than under-reserving space
 * based on whichever trim item happens to win the budget selection.
 */
export function getFootprintEnvelope(catalog: Product[], category: FloorFixtureCategory): Dimensions {
  const items = catalog.filter((p) => p.category === category);
  if (items.length === 0) {
    throw new Error(`No ${category} products in catalog — cannot compute a footprint envelope.`);
  }
  return {
    width: Math.max(...items.map((p) => p.dimensions.width)),
    depth: Math.max(...items.map((p) => p.dimensions.depth)),
    height: Math.max(...items.map((p) => p.dimensions.height)),
  };
}

/**
 * A candidate spot for a fixture, before a category/id is attached to it.
 * `position` follows the exact same back-corner-against-the-wall convention
 * fit-validator.ts's footprintRect() already uses, so a winning candidate
 * plugs straight into the existing clearance/fit geometry unchanged.
 */
export interface PlacementCandidate {
  position: Point;
  wall: Wall;
}

function wallSpan(room: Pick<Room, "widthIn" | "lengthIn">, wall: Wall): number {
  return wall === "north" || wall === "south" ? room.widthIn : room.lengthIn;
}

/** The room dimension a footprint's depth extends into, away from this wall. */
function roomDepthAvailable(room: Pick<Room, "widthIn" | "lengthIn">, wall: Wall): number {
  return wall === "north" || wall === "south" ? room.lengthIn : room.widthIn;
}

/** [start, end) sub-spans of a wall's own span that aren't blocked by a door or window. */
function openSegments(room: Room, wall: Wall): Array<[number, number]> {
  const span = wallSpan(room, wall);
  const blocks = [
    ...room.doors.filter((d) => d.wall === wall).map((d) => [d.offset, d.offset + d.widthIn] as [number, number]),
    ...room.windows.filter((w) => w.wall === wall).map((w) => [w.offset, w.offset + w.widthIn] as [number, number]),
  ].sort((a, b) => a[0] - b[0]);

  const segments: Array<[number, number]> = [];
  let cursor = 0;
  for (const [start, end] of blocks) {
    if (start > cursor) segments.push([cursor, Math.min(start, span)]);
    cursor = Math.max(cursor, end);
  }
  if (cursor < span) segments.push([cursor, span]);
  return segments;
}

/**
 * Converts an "along the wall" coordinate into the room-space Point
 * footprintRect() expects — matches the same start-corner convention t7/t20
 * already agreed on (north/south measured from the west end, east/west from
 * the north end).
 */
function candidatePosition(room: Pick<Room, "widthIn" | "lengthIn">, wall: Wall, along: number): Point {
  switch (wall) {
    case "north":
      return { x: along, y: 0 };
    case "south":
      return { x: along, y: room.lengthIn };
    case "west":
      return { x: 0, y: along };
    case "east":
      return { x: room.widthIn, y: along };
  }
}

/** All valid candidate spots for one footprint along a single wall. */
export function generateWallCandidates(
  room: Room,
  footprint: Dimensions,
  wall: Wall,
  stepIn: number = DEFAULT_STEP_IN,
): PlacementCandidate[] {
  // The footprint's depth extends away from this wall into the room's other
  // dimension — if it's deeper than that, no position on this wall works,
  // regardless of where along the wall it sits.
  if (footprint.depth > roomDepthAvailable(room, wall)) return [];

  const candidates: PlacementCandidate[] = [];
  for (const [start, end] of openSegments(room, wall)) {
    const lastAlong = end - footprint.width;
    for (let along = start; along <= lastAlong + 1e-9; along += stepIn) {
      candidates.push({ position: candidatePosition(room, wall, along), wall });
    }
  }
  return candidates;
}

/** All valid candidate spots for one footprint across all four walls. */
export function generateCandidates(
  room: Room,
  footprint: Dimensions,
  stepIn: number = DEFAULT_STEP_IN,
): PlacementCandidate[] {
  return WALLS.flatMap((wall) => generateWallCandidates(room, footprint, wall, stepIn));
}

/** footprintRect/resolveClearance only ever read `.dimensions` / `.clearanceOverride` off a
 * Product — no specific SKU is known yet at placement time, so this stands in for one. */
function asPlacementProduct(footprint: Dimensions): Product {
  return { dimensions: footprint } as Product;
}

/** A fixture already committed to a spot earlier in the search, for overlap/wall-sharing checks. */
export interface PlacedFixture {
  wall: Wall;
  footprint: Rect;
}

function centerBias(along: number, span: number, width: number): number {
  const distanceToNearestEnd = Math.min(along, span - width - along);
  // (span - width) / 2 is the true achievable maximum for distanceToNearestEnd
  // (reached exactly at dead-center) — normalizing by that, not by span/2,
  // means the bonus hits exactly 0 at dead-center and exactly MAX at a corner.
  const maxDistance = (span - width) / 2;
  const normalized = maxDistance > 0 ? Math.min(1, distanceToNearestEnd / maxDistance) : 0;
  return MAX_CORNER_BONUS * (1 - normalized);
}

/**
 * Scores one candidate against the fixtures already placed earlier in the
 * search. Returns null for a hard geometric conflict (never placeable, no
 * matter how good the rest of the score would be) rather than a low number
 * — keeps "invalid" and "valid but not ideal" clearly distinct.
 */
export function scoreCandidate(
  room: Room,
  candidate: PlacementCandidate,
  footprint: Dimensions,
  category: FloorFixtureCategory,
  alreadyPlaced: PlacedFixture[],
): number | null {
  const product = asPlacementProduct(footprint);
  const rect = footprintRect(product, candidate.position, candidate.wall);

  if (alreadyPlaced.some((placed) => intersects(rect, placed.footprint))) {
    return null;
  }

  const clearance = resolveClearance(product, category);
  const clearZone = clearanceRect(rect, candidate.wall, clearance);
  const clearanceIsClean =
    withinRoom(clearZone, room) && !alreadyPlaced.some((placed) => intersects(clearZone, placed.footprint));
  const clearanceScore = clearanceIsClean ? CLEARANCE_SCORE_CLEAR : CLEARANCE_SCORE_TIGHT;

  const wallShareBonus = alreadyPlaced.some((placed) => placed.wall === candidate.wall) ? WALL_SHARE_BONUS : 0;

  const span = wallSpan(room, candidate.wall);
  const along = candidate.wall === "north" || candidate.wall === "south" ? candidate.position.x : candidate.position.y;
  const cornerBonus = centerBias(along, span, footprint.width);

  return clearanceScore + wallShareBonus + cornerBonus;
}

/**
 * 40, not 20: a real catalog case exposed the smaller value's rank-and-prune
 * cost. The `shower` category's footprint envelope is 60x32in — driven by
 * one outlier SKU (a real curbless shower base; the other 7 are 4-12in trim
 * hardware) — so on a room whose width is close to 60in, every north/south
 * candidate for it scores as "unclean clearance" (its side clearance pokes
 * outside the room) and got pruned out of the independent top-20 before the
 * joint backtracking search ever saw it, even though a fully valid,
 * non-overlapping layout existed. Verified against the real catalog: 20
 * misses a real fit on a 5'x8' hall bath that 40 finds in single-digit
 * milliseconds; worst case measured across several room sizes stayed under
 * 50ms, and this only ever runs once per button click, not per frame.
 */
const DEFAULT_TOP_K = 40;

export interface PlacementResult {
  category: FloorFixtureCategory;
  position: Point;
  wall: Wall;
}

/** Biggest-footprint-plus-tightest-clearance first — a standard best-fit-decreasing
 * bin-packing heuristic: place the hardest-to-fit fixture first and pack the rest
 * around it, rather than in an arbitrary category order. */
export function placementSortKey(footprint: Dimensions, category: FloorFixtureCategory): number {
  const clearance = resolveClearance(asPlacementProduct(footprint), category);
  return footprint.width * footprint.depth + clearance.front * clearance.side;
}

/** All candidates for one category, scored independently of the other fixtures
 * (alreadyPlaced = []) and cut down to the top `topK` — the "rank" half of
 * rank-and-prune. Independent scoring can never hard-reject (nothing to overlap
 * with yet), so every candidate has a real number here, not null. */
function rankCandidates(
  room: Room,
  footprint: Dimensions,
  category: FloorFixtureCategory,
  topK: number,
): PlacementCandidate[] {
  return generateCandidates(room, footprint)
    .map((candidate) => ({ candidate, score: scoreCandidate(room, candidate, footprint, category, []) as number }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map((entry) => entry.candidate);
}

/**
 * Finds the best non-overlapping combination of positions for every category
 * in `categories`, or null if no valid combination exists at all for this
 * exact set.
 *
 * Not an exhaustive search: each category's candidates are independently
 * ranked first (ignoring the other fixtures, see rankCandidates) and only the
 * top `topK` are explored jointly via backtracking. This keeps the search
 * fast regardless of room size — full backtracking over every raw candidate
 * would be too slow to guarantee as rooms get bigger — at the cost of a
 * theoretical (rare, at real room sizes and this topK) chance of missing a
 * valid layout that needs a candidate which scored poorly in isolation but
 * would have fit perfectly once the other fixtures were placed. Same
 * "documented simplification, not code-accurate precision" honesty
 * fit-validator.ts already uses for its own clearance geometry.
 */
export function solvePlacement(
  room: Room,
  categories: FloorFixtureCategory[],
  footprints: Record<FloorFixtureCategory, Dimensions>,
  topK: number = DEFAULT_TOP_K,
): PlacementResult[] | null {
  const order = [...categories].sort(
    (a, b) => placementSortKey(footprints[b], b) - placementSortKey(footprints[a], a),
  );
  const candidatesByCategory: Partial<Record<FloorFixtureCategory, PlacementCandidate[]>> = {};
  for (const category of order) {
    candidatesByCategory[category] = rankCandidates(room, footprints[category], category, topK);
  }

  let bestResult: PlacementResult[] | null = null;
  let bestScore = -Infinity;

  function backtrack(index: number, chosen: PlacementResult[], placed: PlacedFixture[], runningScore: number): void {
    if (index === order.length) {
      if (runningScore > bestScore) {
        bestScore = runningScore;
        bestResult = chosen.slice();
      }
      return;
    }
    const category = order[index];
    const footprint = footprints[category];
    for (const candidate of candidatesByCategory[category]!) {
      const score = scoreCandidate(room, candidate, footprint, category, placed);
      if (score === null) continue;
      const rect = footprintRect(asPlacementProduct(footprint), candidate.position, candidate.wall);
      chosen.push({ category, position: candidate.position, wall: candidate.wall });
      placed.push({ wall: candidate.wall, footprint: rect });
      backtrack(index + 1, chosen, placed, runningScore + score);
      chosen.pop();
      placed.pop();
    }
  }

  backtrack(0, [], [], 0);
  return bestResult;
}

const FULL_FIXTURE_SET: FloorFixtureCategory[] = ["toilet", "vanity", "shower"];

/**
 * The fixed priority for graceful degradation when a room can't fit
 * everything: drop vanity first, then shower too, keep toilet until the
 * very end. Deliberately a fixed sequence, not a general "try every subset"
 * search — simpler to reason about and test, and matches the priority
 * actually asked for (a bathroom needs a toilet; a vanity is the first
 * thing worth sacrificing to a tight room).
 */
const FALLBACK_LADDER: FloorFixtureCategory[][] = [
  ["toilet", "vanity", "shower"],
  ["toilet", "shower"],
  ["toilet"],
];

export type PlacementLadderResult =
  | { feasible: true; placements: PlacementResult[]; omitted: FloorFixtureCategory[] }
  | { feasible: false };

/**
 * No fixed topK is safe for every door/window layout: a real case (a door
 * not flush with its wall's start corner) needed ~60 where the 40 default
 * missed a valid joint layout entirely at the rank-and-prune stage, and nothing
 * says some other layout won't need more still. Rather than keep raising one
 * constant, `placeFixturesWithFallback` retries the *same* rung with a
 * deeper (slower) search before ever concluding it doesn't fit — so the
 * common case stays fast (most rooms solve at the first, cheap step) and the
 * rare miss gets a real second and third chance before a category is
 * dropped. Measured against real room sizes up to 10x12: the deepest step
 * only ever adds up to ~350ms, and only on the rare call that needed it.
 */
const TOP_K_ESCALATION = [DEFAULT_TOP_K, 100, 300];

/**
 * Tries the fallback ladder in order and returns the first rung that fits.
 * Only ever reasons about the three floor-fixture categories — the
 * faucet/lighting cascade (dropping vanity should drop faucet too, since it
 * has no independent plumbing point) belongs at the bundle-building layer
 * that actually knows about those categories, not here.
 */
export function placeFixturesWithFallback(
  room: Room,
  footprints: Record<FloorFixtureCategory, Dimensions>,
): PlacementLadderResult {
  for (const rung of FALLBACK_LADDER) {
    for (const topK of TOP_K_ESCALATION) {
      const result = solvePlacement(room, rung, footprints, topK);
      if (result !== null) {
        const omitted = FULL_FIXTURE_SET.filter((category) => !rung.includes(category));
        return { feasible: true, placements: result, omitted };
      }
    }
  }
  return { feasible: false };
}
