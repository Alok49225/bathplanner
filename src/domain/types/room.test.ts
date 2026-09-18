import { describe, it, expect } from "vitest";
import type { Room, Constraint } from "./room";

function makeRoom(overrides: Partial<Room> = {}): Room {
  return {
    widthIn: 60,
    lengthIn: 96,
    ceilingHeightIn: 96,
    doors: [{ id: "door-1", wall: "south", offset: 12, widthIn: 28, swing: "right" }],
    windows: [{ id: "window-1", wall: "north", offset: 20, widthIn: 24, sillHeightIn: 48 }],
    plumbing: [
      { id: "toilet-rough-in", category: "toilet", position: { x: 10, y: 84 }, wall: "south" },
      { id: "vanity-supply", category: "vanity", position: { x: 6, y: 6 }, wall: "north" },
    ],
    accessibility: {},
    constraints: [],
    ...overrides,
  };
}

describe("Room & constraint schema", () => {
  it("describes a room with a positive footprint and ceiling height", () => {
    const room = makeRoom();
    expect(room.widthIn).toBeGreaterThan(0);
    expect(room.lengthIn).toBeGreaterThan(0);
    expect(room.ceilingHeightIn).toBeGreaterThan(0);
  });

  it("places every fixed opening on one of the four walls", () => {
    const room = makeRoom();
    const walls = ["north", "south", "east", "west"];
    [...room.doors, ...room.windows].forEach((opening) => {
      expect(walls).toContain(opening.wall);
    });
  });

  it("only fixes plumbing rough-ins for the three categories that need one", () => {
    const room = makeRoom();
    const plumbedCategories = ["toilet", "vanity", "shower"];
    room.plumbing.forEach((point) => {
      expect(plumbedCategories).toContain(point.category);
    });
  });

  it("keeps plumbing points inside the room's own footprint", () => {
    const room = makeRoom();
    room.plumbing.forEach((point) => {
      expect(point.position.x).toBeGreaterThanOrEqual(0);
      expect(point.position.x).toBeLessThanOrEqual(room.widthIn);
      expect(point.position.y).toBeGreaterThanOrEqual(0);
      expect(point.position.y).toBeLessThanOrEqual(room.lengthIn);
    });
  });

  it("accepts every accessibility flag independently, all optional", () => {
    const none = makeRoom({ accessibility: {} });
    const some = makeRoom({
      accessibility: { curblessShower: true, loweredVanity: true },
    });
    expect(none.accessibility.curblessShower).toBeUndefined();
    expect(some.accessibility.curblessShower).toBe(true);
    expect(some.accessibility.grabBarZones).toBeUndefined();
  });

  it("represents every constraint rule variant the union defines", () => {
    const constraints: Constraint[] = [
      {
        id: "c1",
        strength: "hard",
        description: "Keep the existing window",
        rule: { type: "keep-fixture", category: "vanity" },
      },
      {
        id: "c2",
        strength: "soft",
        description: "Partner wants a soaking tub",
        rule: { type: "must-include-tag", tag: "soaking-tub" },
      },
      {
        id: "c3",
        strength: "soft",
        description: "No glossy finishes",
        rule: { type: "avoid-tag", tag: "glossy" },
      },
      {
        id: "c4",
        strength: "hard",
        description: "No specialist install work",
        rule: { type: "max-install-complexity", level: "standard" },
      },
    ];
    const room = makeRoom({ constraints });
    expect(room.constraints).toHaveLength(4);
    expect(room.constraints.map((c) => c.rule.type)).toEqual([
      "keep-fixture",
      "must-include-tag",
      "avoid-tag",
      "max-install-complexity",
    ]);
  });

  it("lets a hard constraint and a soft constraint coexist", () => {
    const room = makeRoom({
      constraints: [
        {
          id: "hard-1",
          strength: "hard",
          description: "Must stay under budget",
          rule: { type: "max-install-complexity", level: "drop-in" },
        },
        {
          id: "soft-1",
          strength: "soft",
          description: "Prefer matte finishes",
          rule: { type: "must-include-tag", tag: "matte" },
        },
      ],
    });
    const strengths = room.constraints.map((c) => c.strength);
    expect(strengths).toContain("hard");
    expect(strengths).toContain("soft");
  });
});
