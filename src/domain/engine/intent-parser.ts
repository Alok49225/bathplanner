/**
 * Intent parser — turns a free-text chat message into a structured intent
 * the Application layer (t27) can act on. Deliberately deterministic
 * keyword/pattern matching, not an LLM call — same "predictable for demo
 * day" principle t11's rationale generator was built on. Anything it can't
 * confidently classify becomes `unrecognized`, never a silent wrong guess —
 * that's intentional groundwork for t29's fallback handling, not a gap to
 * patch here.
 *
 * Pure text in, structured intent out: no catalog access, no session
 * access, no re-solve call. `pin-item` only carries a category, not a
 * product id, because expecting a user to type an exact SKU name isn't
 * realistic — "keep the vanity" means "lock whatever's currently selected
 * there," which t27 resolves against the bundle on screen.
 */

import type { ProductCategory } from "../types/product";

export type ParsedIntent =
  | { kind: "change-budget"; mode: "set"; budgetCents: number }
  | { kind: "change-budget"; mode: "delta"; deltaCents: number }
  | { kind: "pin-item"; category: ProductCategory }
  | { kind: "swap-item"; category: ProductCategory; direction: "cheaper" | "pricier" }
  | { kind: "unrecognized"; rawText: string };

const CATEGORY_PATTERNS: [ProductCategory, RegExp][] = [
  ["toilet", /\btoilets?\b/],
  ["vanity", /\bvanit(?:y|ies)\b|\bsinks?\b/],
  ["faucet", /\bfaucets?\b/],
  ["shower", /\bshowers?\b/],
  ["lighting", /\blighting\b|\blights?\b/],
];

/** Exported so t29's fallback-message logic can reuse this exact matching instead of re-deriving it. */
export function detectCategory(text: string): ProductCategory | null {
  for (const [category, pattern] of CATEGORY_PATTERNS) {
    if (pattern.test(text)) return category;
  }
  return null;
}

const BUDGET_KEYWORDS = /\b(budget|spend|afford)\b/;
const AMOUNT_PATTERN = /\$?\s*([\d,]+(?:\.\d+)?)\s*(k\b)?/i;
const DELTA_UP_WORDS = /\b(increase|raise|add|up|more)\b/;
const DELTA_DOWN_WORDS = /\b(decrease|lower|reduce|drop|cut|less)\b/;
const PIN_WORDS = /\b(keep|pin|lock|stick with|stay with)\b/;
const CHEAPER_WORDS = /\b(cheap|cheaper|less expensive|lower cost|downgrade|inexpensive)\b/;
const PRICIER_WORDS = /\b(nicer|nice|premium|pricier|expensive|upgrade|luxury|better|fancier)\b/;

function parseAmountCents(text: string): number | null {
  const match = text.match(AMOUNT_PATTERN);
  if (!match) return null;
  let amount = parseFloat(match[1].replace(/,/g, ""));
  if (Number.isNaN(amount)) return null;
  if (match[2]) amount *= 1000; // "6k"
  return Math.round(amount * 100);
}

function parseBudgetIntent(text: string): ParsedIntent | null {
  if (!BUDGET_KEYWORDS.test(text)) return null;
  const amountCents = parseAmountCents(text);
  if (amountCents === null) return null;

  if (DELTA_UP_WORDS.test(text)) return { kind: "change-budget", mode: "delta", deltaCents: amountCents };
  if (DELTA_DOWN_WORDS.test(text)) return { kind: "change-budget", mode: "delta", deltaCents: -amountCents };
  return { kind: "change-budget", mode: "set", budgetCents: amountCents };
}

export function parseIntent(rawText: string): ParsedIntent {
  const text = rawText.toLowerCase();

  // Budget changes take precedence — they're room-wide, so a message that
  // happens to mention both a budget figure and a category is read as a
  // budget change first.
  const budgetIntent = parseBudgetIntent(text);
  if (budgetIntent) return budgetIntent;

  const category = detectCategory(text);
  if (category) {
    if (PIN_WORDS.test(text)) return { kind: "pin-item", category };
    if (CHEAPER_WORDS.test(text)) return { kind: "swap-item", category, direction: "cheaper" };
    if (PRICIER_WORDS.test(text)) return { kind: "swap-item", category, direction: "pricier" };
  }

  return { kind: "unrecognized", rawText };
}
