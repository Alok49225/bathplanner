/**
 * Intake orchestration — the Application-layer box from the architecture
 * diagram. Turns session state (t18) into a solve call: loads the catalog
 * through the CatalogRepository interface (never the concrete Infrastructure
 * class — that stays Presentation's job to construct and inject, keeping
 * Application's only dependency on Infrastructure the Domain interface
 * itself, same "implements" inversion the diagram draws for Infrastructure).
 */

import { useEffect, useState } from "react";
import type { SessionState } from "./session-state";
import type { CatalogRepository } from "../domain/catalog-repository";
import type { Product, Theme } from "../domain/types/product";
import type { Room } from "../domain/types/room";
import type { Bundle } from "../domain/types/bundle";
import { generateTiers } from "../domain/engine/tier-generator";
import type { CompatibilityIssue } from "../domain/engine/compatibility-rules";

export type IntakeSolveStatus =
  | "loading-catalog"
  | "catalog-error"
  | "no-preset-theme"
  | "solving"
  | "solved"
  | "infeasible";

export type InfeasibleReason = "no-eligible-options" | "missing-plumbing-point" | "over-budget";

export interface IntakeSolveResult {
  status: IntakeSolveStatus;
  tiers?: [Bundle, Bundle, Bundle];
  infeasibleReason?: InfeasibleReason;
  cheapestPossibleCents?: number;
  issues?: CompatibilityIssue[];
}

const DEBOUNCE_MS = 400;

/** Exported so other Application-layer orchestration (chat-orchestration.ts, t27) reuses this exact conversion instead of duplicating it. */
export function toRoom(session: SessionState): Room {
  return {
    ...session.room,
    accessibility: {},
    constraints: [],
  };
}

export function useIntakeSolve(session: SessionState, repository: CatalogRepository): IntakeSolveResult {
  const [catalog, setCatalog] = useState<Product[] | null>(null);
  const [catalogError, setCatalogError] = useState(false);
  const [result, setResult] = useState<IntakeSolveResult>({ status: "loading-catalog" });

  useEffect(() => {
    let cancelled = false;
    repository
      .getAll()
      .then((products) => {
        if (!cancelled) setCatalog(products);
      })
      .catch(() => {
        if (!cancelled) setCatalogError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [repository]);

  useEffect(() => {
    if (catalogError) {
      setResult({ status: "catalog-error" });
      return;
    }
    if (!catalog) {
      setResult({ status: "loading-catalog" });
      return;
    }
    if (session.theme.kind !== "preset") {
      setResult({ status: "no-preset-theme" });
      return;
    }
    const theme: Theme = session.theme.theme;

    setResult({ status: "solving" });

    const timer = setTimeout(() => {
      const room = toRoom(session);
      const solveResult = generateTiers(catalog, room, session.budgetCents, theme);
      if (solveResult.feasible) {
        setResult({ status: "solved", tiers: solveResult.tiers });
      } else if (solveResult.reason === "over-budget") {
        setResult({
          status: "infeasible",
          infeasibleReason: "over-budget",
          cheapestPossibleCents: solveResult.cheapestPossibleCents,
        });
      } else if (solveResult.reason === "no-eligible-options") {
        setResult({ status: "infeasible", infeasibleReason: "no-eligible-options", issues: solveResult.issues });
      } else {
        setResult({ status: "infeasible", infeasibleReason: "missing-plumbing-point" });
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [catalog, catalogError, session]);

  return result;
}
