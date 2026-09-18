/**
 * Session state — the Application layer's "Session state" box from the
 * architecture diagram. Holds Room dimensions + budget + theme for the
 * current browser session. No account exists in this MVP to gate on
 * ("guest mode" per the blueprint is simply the absence of that gate) —
 * this is the actual deliverable: state that survives a refresh via
 * sessionStorage, but never persists across tabs, devices, or visits,
 * matching what "no account" implies.
 */

import { useCallback, useEffect, useState } from "react";
import type { RoomDimensions } from "../domain/types/room";
import type { ThemeSelection } from "../domain/types/product";

export interface SessionState {
  room: RoomDimensions;
  budgetCents: number;
  theme: ThemeSelection;
}

const STORAGE_KEY = "bath-planner-session";

export function defaultSessionState(): SessionState {
  return {
    room: {
      widthIn: 60,
      lengthIn: 96,
      ceilingHeightIn: 96,
      doors: [],
      windows: [],
      plumbing: [],
    },
    budgetCents: 500_000,
    theme: { kind: "preset", theme: "minimalist-modern" },
  };
}

export function loadSessionState(): SessionState | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || !parsed.room || !parsed.theme) return null;
    return parsed as SessionState;
  } catch {
    return null;
  }
}

export function saveSessionState(state: SessionState): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // sessionStorage unavailable (private browsing, quota) — state just
    // won't survive a refresh; the app still works for this render.
  }
}

export function clearSessionState(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // as above — nothing to clean up if it never wrote.
  }
}

export function useSessionState(): [SessionState, (patch: Partial<SessionState>) => void] {
  const [state, setState] = useState<SessionState>(() => loadSessionState() ?? defaultSessionState());

  useEffect(() => {
    saveSessionState(state);
  }, [state]);

  const patch = useCallback((update: Partial<SessionState>) => {
    setState((prev) => ({ ...prev, ...update }));
  }, []);

  return [state, patch];
}
