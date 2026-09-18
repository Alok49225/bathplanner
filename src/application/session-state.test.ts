import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  defaultSessionState,
  loadSessionState,
  saveSessionState,
  clearSessionState,
  useSessionState,
} from "./session-state";
import type { SessionState } from "./session-state";

beforeEach(() => {
  sessionStorage.clear();
});

describe("session state persistence", () => {
  it("returns null when nothing has been saved", () => {
    expect(loadSessionState()).toBeNull();
  });

  it("returns null for corrupt storage instead of throwing", () => {
    sessionStorage.setItem("bath-planner-session", "{not valid json");
    expect(loadSessionState()).toBeNull();
  });

  it("round-trips a saved state exactly", () => {
    const state: SessionState = {
      ...defaultSessionState(),
      budgetCents: 750_000,
    };
    saveSessionState(state);
    expect(loadSessionState()).toEqual(state);
  });

  it("clearSessionState actually removes the stored value", () => {
    saveSessionState(defaultSessionState());
    expect(loadSessionState()).not.toBeNull();
    clearSessionState();
    expect(loadSessionState()).toBeNull();
  });

  it("defaultSessionState needs no account — every field is preset, nothing requires login", () => {
    const state = defaultSessionState();
    expect(state.room.widthIn).toBeGreaterThan(0);
    expect(state.budgetCents).toBeGreaterThan(0);
    expect(state.theme.kind).toBe("preset");
  });
});

describe("useSessionState", () => {
  it("initializes from existing sessionStorage when present", () => {
    const saved: SessionState = { ...defaultSessionState(), budgetCents: 900_000 };
    saveSessionState(saved);
    const { result } = renderHook(() => useSessionState());
    expect(result.current[0].budgetCents).toBe(900_000);
  });

  it("falls back to defaults when sessionStorage is empty", () => {
    const { result } = renderHook(() => useSessionState());
    expect(result.current[0]).toEqual(defaultSessionState());
  });

  it("patches only the given fields, leaving the rest untouched", () => {
    const { result } = renderHook(() => useSessionState());
    act(() => result.current[1]({ budgetCents: 300_000 }));
    expect(result.current[0].budgetCents).toBe(300_000);
    expect(result.current[0].room).toEqual(defaultSessionState().room);
  });

  it("persists to sessionStorage on every patch", () => {
    const { result } = renderHook(() => useSessionState());
    act(() => result.current[1]({ budgetCents: 420_000 }));
    expect(loadSessionState()?.budgetCents).toBe(420_000);
  });
});
