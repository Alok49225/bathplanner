import { describe, it, expect } from "vitest";
import { parseIntent } from "./intent-parser";

describe("parseIntent", () => {
  describe("change-budget", () => {
    it("parses an absolute budget as mode:set", () => {
      expect(parseIntent("set my budget to $6000")).toEqual({
        kind: "change-budget",
        mode: "set",
        budgetCents: 600000,
      });
    });

    it("parses a comma-formatted amount", () => {
      expect(parseIntent("my budget is $6,000")).toEqual({
        kind: "change-budget",
        mode: "set",
        budgetCents: 600000,
      });
    });

    it("parses a 'k' suffix as thousands", () => {
      expect(parseIntent("change my budget to 6k")).toEqual({
        kind: "change-budget",
        mode: "set",
        budgetCents: 600000,
      });
    });

    it("parses an increase as a positive delta", () => {
      expect(parseIntent("increase my budget by $500")).toEqual({
        kind: "change-budget",
        mode: "delta",
        deltaCents: 50000,
      });
    });

    it("parses a decrease as a negative delta", () => {
      expect(parseIntent("lower the budget by 200")).toEqual({
        kind: "change-budget",
        mode: "delta",
        deltaCents: -20000,
      });
    });

    it("requires a budget-related keyword, not just a dollar figure", () => {
      // no "budget"/"spend"/"afford" — not enough to safely assume a budget change
      expect(parseIntent("the $30 faucet")).toEqual({ kind: "unrecognized", rawText: "the $30 faucet" });
    });

    it("is case-insensitive", () => {
      expect(parseIntent("SET MY BUDGET TO $6000")).toEqual({
        kind: "change-budget",
        mode: "set",
        budgetCents: 600000,
      });
    });
  });

  describe("pin-item", () => {
    it.each([
      ["keep the vanity", "vanity"],
      ["pin the toilet", "toilet"],
      ["lock in the shower", "shower"],
      ["let's stick with the faucet", "faucet"],
    ] as const)("recognizes %s", (text, category) => {
      expect(parseIntent(text)).toEqual({ kind: "pin-item", category });
    });

    it("recognizes the 'sink' synonym for vanity", () => {
      expect(parseIntent("keep the sink")).toEqual({ kind: "pin-item", category: "vanity" });
    });

    it("recognizes the 'light'/'lights' synonym for lighting", () => {
      expect(parseIntent("keep the lights")).toEqual({ kind: "pin-item", category: "lighting" });
    });
  });

  describe("swap-item", () => {
    it("recognizes a request for something cheaper", () => {
      expect(parseIntent("swap the faucet for something cheaper")).toEqual({
        kind: "swap-item",
        category: "faucet",
        direction: "cheaper",
      });
    });

    it("recognizes a request for something pricier", () => {
      expect(parseIntent("make the shower nicer")).toEqual({
        kind: "swap-item",
        category: "shower",
        direction: "pricier",
      });
    });

    it("recognizes 'upgrade' as pricier", () => {
      expect(parseIntent("I want to upgrade the vanity")).toEqual({
        kind: "swap-item",
        category: "vanity",
        direction: "pricier",
      });
    });

    it("recognizes 'downgrade' as cheaper", () => {
      expect(parseIntent("downgrade the lighting")).toEqual({
        kind: "swap-item",
        category: "lighting",
        direction: "cheaper",
      });
    });
  });

  describe("precedence", () => {
    it("treats a budget change as taking priority over a category + direction in the same message", () => {
      expect(parseIntent("increase my budget by $500 and get a cheaper faucet")).toEqual({
        kind: "change-budget",
        mode: "delta",
        deltaCents: 50000,
      });
    });

    it("treats pin as taking priority over swap direction when both somehow appear", () => {
      // contrived, but locks in the documented precedence rather than leaving it accidental
      expect(parseIntent("keep the nicer faucet")).toEqual({ kind: "pin-item", category: "faucet" });
    });
  });

  describe("unrecognized", () => {
    it("falls back for empty text", () => {
      expect(parseIntent("")).toEqual({ kind: "unrecognized", rawText: "" });
    });

    it("falls back for text with no matching category or budget signal", () => {
      const text = "what do you think of this room";
      expect(parseIntent(text)).toEqual({ kind: "unrecognized", rawText: text });
    });

    it("falls back for a category mention with no actionable verb", () => {
      const text = "tell me about the toilet";
      expect(parseIntent(text)).toEqual({ kind: "unrecognized", rawText: text });
    });
  });
});
