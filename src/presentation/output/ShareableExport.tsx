import { FloorPlan } from "../viz/FloorPlan";
import { FixtureLayer } from "../viz/FixtureLayer";
import { BundleSummary } from "./BundleSummary";
import type { Bundle, BundleTier } from "../../domain/types/bundle";
import type { Product } from "../../domain/types/product";
import type { RoomDimensions } from "../../domain/types/room";
import "./ShareableExport.css";

export interface ShareableExportProps {
  bundle: Bundle;
  catalog: Product[];
  room: RoomDimensions;
}

const TIER_LABELS: Record<BundleTier, string> = {
  value: "Value",
  balanced: "Balanced",
  premium: "Premium",
};

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

/**
 * PDF via the browser's own print dialog, not a shareable link — this app
 * has no backend to persist state for a link to point at, and a real API
 * key can't be safely embedded in a public-repo client-side app anyway.
 * window.print() needs no dependency, no server, and works fully offline.
 */
export function ShareableExport({ bundle, catalog, room }: ShareableExportProps) {
  return (
    <div className="shareable-export">
      <div className="shareable-export-toolbar">
        <button type="button" onClick={() => window.print()}>
          Print / Save as PDF
        </button>
      </div>

      <div className="shareable-export-sheet">
        <h2 className="shareable-export-title">Bath Planner — {TIER_LABELS[bundle.tier]} bundle</h2>
        <p className="shareable-export-meta">
          Room: {room.widthIn}in × {room.lengthIn}in &middot; Budget:{" "}
          {currencyFormatter.format(bundle.budgetCents / 100)}
        </p>

        <div className="shareable-export-plan-stack">
          <FloorPlan room={room} showLegend={false} />
          <div className="shareable-export-fixture-overlay">
            <FixtureLayer bundle={bundle} catalog={catalog} room={room} />
          </div>
        </div>

        <BundleSummary bundle={bundle} catalog={catalog} />
      </div>
    </div>
  );
}
