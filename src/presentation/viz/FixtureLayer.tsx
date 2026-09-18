import { useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import type { Bundle } from "../../domain/types/bundle";
import type { Product, ProductCategory } from "../../domain/types/product";
import type { RoomDimensions, Point } from "../../domain/types/room";
import { footprintRect, clearanceRect, resolveClearance, validateFit } from "../../domain/engine/fit-validator";
import type { FloorFixtureCategory, FloorFixturePlacement } from "../../domain/engine/fit-validator";
import "./FixtureLayer.css";

export interface FixtureLayerProps {
  bundle: Bundle;
  catalog: Product[];
  room: RoomDimensions;
}

const FLOOR_CATEGORIES: FloorFixtureCategory[] = ["toilet", "vanity", "shower"];
const MARKER_CATEGORIES: ProductCategory[] = ["faucet", "lighting"];
const ALL_CATEGORIES: ProductCategory[] = ["toilet", "vanity", "faucet", "shower", "lighting"];

const CATEGORY_LABELS: Record<ProductCategory, string> = {
  toilet: "Toilet",
  vanity: "Vanity",
  faucet: "Faucet",
  shower: "Shower",
  lighting: "Lighting",
};

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

/**
 * Faucet and lighting share the vanity's exact position (t10's convention —
 * neither has an independent plumbing point). Rendered at identical
 * coordinates they'd be indistinguishable, so this nudges only the DRAWING
 * a few inches apart. It never touches item.placement.position itself — the
 * underlying data stays exactly what the solver returned; a viewer hovering
 * the marker still sees in its tooltip that it shares the vanity's rough-in.
 */
const MARKER_OFFSET: Partial<Record<ProductCategory, Point>> = {
  faucet: { x: -4, y: 0 },
  lighting: { x: 4, y: 0 },
};

interface HoverState {
  text: string;
  x: number;
  y: number;
}

function resolveProduct(catalog: Product[], productId: string): Product | undefined {
  return catalog.find((p) => p.id === productId);
}

function hoverText(product: Product): string {
  return `${product.name} · ${currencyFormatter.format(product.priceCents / 100)}`;
}

export function FixtureLayer({ bundle, catalog, room }: FixtureLayerProps) {
  const [hover, setHover] = useState<HoverState | null>(null);

  function showHover(e: ReactMouseEvent<SVGGraphicsElement>, text: string) {
    const rect = e.currentTarget.getBoundingClientRect();
    setHover({ text, x: rect.left + rect.width / 2, y: rect.top });
  }
  function hideHover() {
    setHover(null);
  }

  // Bundle.warnings is already-flattened text by the time it reaches here
  // (t10 converts FitIssue[] to plain strings) — category and severity are
  // gone. Re-running validateFit directly, rather than parsing them back out
  // of a string, reuses t7's own computation instead of trusting a message.
  const floorPlacements: FloorFixturePlacement[] = FLOOR_CATEGORIES.flatMap((category) => {
    const item = bundle.items[category];
    const product = resolveProduct(catalog, item.productId);
    const plumbingPoint = room.plumbing.find((p) => p.category === category);
    if (!product || !plumbingPoint) return [];
    return [{ category, product, plumbingPointId: plumbingPoint.id }];
  });
  // validateFit needs a full Room; RoomDimensions (t14's scope) omits
  // accessibility/constraints, which don't affect clearance geometry —
  // same conversion t17's orchestration hook already does for the same reason.
  const tightCategories = new Set(
    validateFit(floorPlacements, { ...room, accessibility: {}, constraints: [] })
      .filter((issue) => issue.code === "insufficient-clearance")
      .map((issue) => issue.category)
  );

  return (
    <div className="fixture-layer-container">
      <svg
        className="fixture-layer"
        viewBox={`0 0 ${room.widthIn} ${room.lengthIn}`}
        role="img"
        aria-label="Bundle fixtures placed on the floor plan — hover a fixture for its name and price"
      >
        {FLOOR_CATEGORIES.map((category) => {
          const item = bundle.items[category];
          const product = resolveProduct(catalog, item.productId);
          const plumbingPoint = room.plumbing.find((p) => p.category === category);
          if (!product || !plumbingPoint) return null; // defensive: this component takes plain data, no guarantee it's internally consistent

          const rect = footprintRect(product, item.placement.position, plumbingPoint.wall);
          const isTight = tightCategories.has(category);
          const clearance = isTight ? clearanceRect(rect, plumbingPoint.wall, resolveClearance(product, category)) : null;

          return (
            <g key={category}>
              {clearance && (
                <rect
                  className="fixture-clearance-overlay"
                  data-testid={`clearance-${category}`}
                  x={Math.min(clearance.x1, clearance.x2)}
                  y={Math.min(clearance.y1, clearance.y2)}
                  width={Math.abs(clearance.x2 - clearance.x1)}
                  height={Math.abs(clearance.y2 - clearance.y1)}
                />
              )}
              <rect
                className={`fixture fixture-${category}`}
                data-testid={`fixture-${category}`}
                x={Math.min(rect.x1, rect.x2)}
                y={Math.min(rect.y1, rect.y2)}
                width={Math.abs(rect.x2 - rect.x1)}
                height={Math.abs(rect.y2 - rect.y1)}
                onMouseEnter={(e) => showHover(e, hoverText(product))}
                onMouseLeave={hideHover}
              >
                <title>{product.name}</title>
              </rect>
            </g>
          );
        })}

        {MARKER_CATEGORIES.map((category) => {
          const item = bundle.items[category];
          const product = resolveProduct(catalog, item.productId);
          if (!product) return null;

          const offset = MARKER_OFFSET[category] ?? { x: 0, y: 0 };
          const x = item.placement.position.x + offset.x;
          const y = item.placement.position.y + offset.y;
          const r = 2.5;

          return (
            <polygon
              key={category}
              className={`fixture-marker fixture-marker-${category}`}
              data-testid={`fixture-${category}`}
              points={`${x},${y - r} ${x + r},${y} ${x},${y + r} ${x - r},${y}`}
              onMouseEnter={(e) => showHover(e, hoverText(product))}
              onMouseLeave={hideHover}
            >
              <title>{product.name} (shares the vanity's rough-in)</title>
            </polygon>
          );
        })}
      </svg>

      {hover && (
        <div className="fixture-tooltip" style={{ left: hover.x, top: hover.y }}>
          {hover.text}
        </div>
      )}

      <div className="fixture-legend">
        {ALL_CATEGORIES.map((category) => (
          <span key={category} className="fixture-legend-item">
            <span
              className={
                MARKER_CATEGORIES.includes(category)
                  ? `fixture-legend-swatch fixture-legend-swatch-diamond fixture-marker-${category}`
                  : `fixture-legend-swatch fixture-${category}`
              }
            />
            {CATEGORY_LABELS[category]}
          </span>
        ))}
      </div>
    </div>
  );
}
