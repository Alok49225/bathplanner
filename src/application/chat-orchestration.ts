/**
 * Chat orchestration — turns a chat message into the same solver machinery
 * the form uses. For a budget change that's literally the same path
 * (patchSession, which useIntakeSolve's own effect already re-solves on);
 * for pin/swap it's pinAndResolve (t12), which the form has never called
 * but is the real, correct engine primitive for "lock this in"/"swap it."
 *
 * Deliberately doesn't merge a pin/swap result back into
 * IntakeSolveResult.tiers — `pinnedBundle` stays its own explicit piece of
 * state instead, and the composing page (App.tsx) decides whether to show
 * it in place of the auto-solved bundle for the selected tier. It's reset
 * to null whenever `solve.tiers` changes, since a fresh solve means the
 * pin was computed against session state that's no longer current.
 */

import { useCallback, useEffect, useState } from "react";
import type { SessionState } from "./session-state";
import { toRoom } from "./intake-orchestration";
import type { IntakeSolveResult } from "./intake-orchestration";
import type { CatalogRepository } from "../domain/catalog-repository";
import type { Product, ProductCategory } from "../domain/types/product";
import type { Bundle, BundleTier } from "../domain/types/bundle";
import { parseIntent, detectCategory } from "../domain/engine/intent-parser";
import { filterEligibleProducts } from "../domain/engine/compatibility-rules";
import { pinAndResolve } from "../domain/engine/pin-resolve";
import type { PinResolveResult } from "../domain/engine/pin-resolve";

/**
 * Owned by Application, not Presentation — same move t18 made for
 * RoomDimensions/ThemeSelection once Application needed them.
 * ChatPanel.tsx re-exports this so its existing imports keep working.
 */
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
}

export interface UseChatSolveArgs {
  session: SessionState;
  patchSession: (patch: Partial<SessionState>) => void;
  repository: CatalogRepository;
  solve: IntakeSolveResult;
  selectedTier: BundleTier;
}

export interface UseChatSolveResult {
  messages: ChatMessage[];
  sendMessage: (text: string) => void;
  /** The bundle produced by the most recent pin/swap, if any. See file comment. */
  pinnedBundle: Bundle | null;
}

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function reasonToMessage(result: Extract<PinResolveResult, { feasible: false }>): string {
  switch (result.reason) {
    case "invalid-pin":
      return "Something went wrong finding that product — try again.";
    case "no-eligible-options":
      return `${result.issues.map((i) => i.message).join(" ")} Try adjusting the room dimensions or removing a style constraint.`;
    case "missing-plumbing-point":
      return "Add a plumbing point for the toilet, vanity, and shower first — then I can adjust your bundle.";
    case "over-budget":
      return `Even with that change, the cheapest option costs ${currencyFormatter.format(
        result.cheapestPossibleCents / 100
      )} — over budget.`;
  }
}

// Deliberate, small, explicit keyword lists — same deterministic philosophy
// as t26, not an attempt at exhaustive NLP. Split into two groups because
// they deserve different guidance: one points back at the actual form
// control that already handles it, the other is genuinely nothing this
// app tracks at all.
const OUT_OF_SCOPE_ROOM_WORDS = /\b(door|window|room size|dimensions|resize|bigger room|smaller room)\b/;
const OUT_OF_SCOPE_PRODUCT_WORDS =
  /\b(bathtub|tub|paint|tile|flooring|mirror|ventilation|exhaust fan|fan|heated floor)\b/;
// A generic swap verb with no cheaper/pricier word — parseIntent correctly
// refuses to guess a direction (same "never invent an intent" principle as
// everywhere else), but the fallback can still be more specific than "not
// sure what you'd like" once it's this close to a real swap-item intent.
const SWAP_VERB_WORDS = /\b(swap|change|replace|different|another)\b/;

/**
 * Four-tier graceful fallback for text parseIntent couldn't classify —
 * most-specific first. Never invents an action; only chooses which
 * explanation to show. See intent-parser.ts's own doc comment: `unrecognized`
 * was always meant to land here, this just makes "here" more helpful.
 */
function fallbackMessage(rawText: string): string {
  const text = rawText.toLowerCase();

  const category = detectCategory(text);
  if (category) {
    if (SWAP_VERB_WORDS.test(text)) {
      return `I can tell you want to swap the ${category} — just say cheaper or pricier, e.g. "swap the ${category} for something cheaper."`;
    }
    return `I can see you're asking about the ${category}, but I'm not sure what you'd like — try "keep the ${category}" or "swap the ${category} for something cheaper."`;
  }

  if (OUT_OF_SCOPE_ROOM_WORDS.test(text)) {
    return "I can't resize the room or change doors/windows from chat — use the room details form above for that.";
  }

  if (OUT_OF_SCOPE_PRODUCT_WORDS.test(text)) {
    return "I can only help with the toilet, vanity, faucet, shower, and lighting in this room — I can't change that from chat yet.";
  }

  return 'I didn\'t quite catch that — try things like "increase my budget by $500" or "keep the vanity".';
}

/** Closest eligible neighbor strictly cheaper/pricier than the current price — not the cheapest/priciest overall, so repeated swaps move one step at a time. */
function findNeighborProduct(
  eligible: Product[],
  currentPriceCents: number,
  direction: "cheaper" | "pricier"
): Product | null {
  const candidates =
    direction === "cheaper"
      ? eligible.filter((p) => p.priceCents < currentPriceCents).sort((a, b) => b.priceCents - a.priceCents)
      : eligible.filter((p) => p.priceCents > currentPriceCents).sort((a, b) => a.priceCents - b.priceCents);
  return candidates[0] ?? null;
}

export function useChatSolve({
  session,
  patchSession,
  repository,
  solve,
  selectedTier,
}: UseChatSolveArgs): UseChatSolveResult {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pinnedBundle, setPinnedBundle] = useState<Bundle | null>(null);

  // A fresh solve.tiers means the room/budget/theme changed and the form
  // re-solved from scratch — any earlier chat pin was computed against
  // session state that's now stale, so it can't keep silently overriding
  // the real current result. pinAndResolve itself never touches solve.tiers,
  // so this only fires on a genuine new solve, never as a side effect of
  // the chat's own pin/swap actions.
  useEffect(() => {
    setPinnedBundle(null);
  }, [solve.tiers]);

  const reply = useCallback((text: string) => {
    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "assistant", text }]);
  }, []);

  const applyPin = useCallback(
    async (kind: "pin" | "swap", category: ProductCategory, productId: string) => {
      if (session.theme.kind !== "preset") {
        reply("Pick a preset style first, then I can adjust your bundle.");
        return;
      }
      const catalog = await repository.getAll();
      const room = toRoom(session);
      const result = pinAndResolve(
        catalog,
        room,
        session.budgetCents,
        session.theme.theme,
        selectedTier,
        category,
        productId
      );
      if (result.feasible) {
        setPinnedBundle(result.bundle);
        const product = catalog.find((p) => p.id === productId);
        const productName = product ? product.name : "that product";
        if (kind === "swap") {
          // buildBundle (t10) already ran generateRationale (t11) for every
          // item, including this one — reusing it here, not re-deriving it.
          const rationale = result.bundle.items[category]?.rationale;
          reply(`Swapped the ${category} for ${productName}${rationale ? ` — ${rationale}` : ""}.`);
        } else {
          reply(`Locked in ${productName} for the ${category} — it'll stay in your ${selectedTier} bundle.`);
        }
      } else {
        reply(reasonToMessage(result));
      }
    },
    [session, repository, selectedTier, reply]
  );

  const sendMessage = useCallback(
    (text: string) => {
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "user", text }]);
      const intent = parseIntent(text);

      switch (intent.kind) {
        case "change-budget": {
          const newBudgetCents = Math.max(
            0,
            intent.mode === "set" ? intent.budgetCents : session.budgetCents + intent.deltaCents
          );
          patchSession({ budgetCents: newBudgetCents });
          reply(`Updated your budget to ${currencyFormatter.format(newBudgetCents / 100)}.`);
          return;
        }

        case "pin-item": {
          if (solve.status !== "solved" || !solve.tiers) {
            reply("I don't have a bundle to pin yet — finish your room details first.");
            return;
          }
          const bundle = solve.tiers.find((b) => b.tier === selectedTier)!;
          const currentItem = bundle.items[intent.category];
          if (!currentItem) {
            reply(`There's no ${intent.category} in this bundle — the room was too small to fit one.`);
            return;
          }
          void applyPin("pin", intent.category, currentItem.productId);
          return;
        }

        case "swap-item": {
          if (solve.status !== "solved" || !solve.tiers) {
            reply("I don't have a bundle to swap yet — finish your room details first.");
            return;
          }
          if (session.theme.kind !== "preset") {
            reply("Pick a preset style first, then I can adjust your bundle.");
            return;
          }
          const bundle = solve.tiers.find((b) => b.tier === selectedTier)!;
          const currentItem = bundle.items[intent.category];
          if (!currentItem) {
            reply(`There's no ${intent.category} in this bundle — the room was too small to fit one.`);
            return;
          }
          const currentProductId = currentItem.productId;

          void (async () => {
            const catalog = await repository.getAll();
            const currentProduct = catalog.find((p) => p.id === currentProductId);
            const room = toRoom(session);
            const { eligible } = filterEligibleProducts(catalog, room);
            const neighbor = currentProduct
              ? findNeighborProduct(eligible[intent.category], currentProduct.priceCents, intent.direction)
              : null;

            if (!neighbor) {
              const extreme = intent.direction === "cheaper" ? "cheapest" : "priciest";
              reply(`That's already the ${extreme} ${intent.category} option available.`);
              return;
            }
            await applyPin("swap", intent.category, neighbor.id);
          })();
          return;
        }

        case "unrecognized": {
          reply(fallbackMessage(intent.rawText));
          return;
        }
      }
    },
    [session, solve, selectedTier, patchSession, repository, applyPin, reply]
  );

  return { messages, sendMessage, pinnedBundle };
}
