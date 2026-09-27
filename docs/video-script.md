# Bath Planner — Video Demonstration Script

Target length: **90–120 seconds** (fits the 1–3 minute requirement with room to spare). Record against the live app at **kohlerbathplanner.vercel.app**, not localhost, so it's obviously a real deployed product.

Do the walkthrough live and let the numbers be whatever your inputs actually produce — don't try to match exact figures below, they're illustrative only.

---

## Before you hit record

- Open the live URL in a clean browser tab (private/incognito avoids stale `sessionStorage` from prior testing).
- Have a room size in mind ahead of time (e.g. 8'×12') so you're not pausing to think on camera.
- Rehearse the click-to-place step once — it's the most "wow" visual moment and the easiest to fumble live.
- Know your chat line in advance: **"swap the vanity for something cheaper"** works reliably and shows a real re-solve.

---

## Shot-by-shot script

**0:00–0:10 — Cold open**
On screen: the live app, title visible.
Say: *"This is Bath Planner — an AI-assisted bathroom designer built for a KOHLER case study. It turns a room's dimensions, a budget, and a style into physically valid, explainable product bundles."*

**0:10–0:30 — Describe the room**
On screen: type in width/length/ceiling height, then click directly on the floor plan three times to place the toilet, vanity, and shower.
Say: *"You start with the room. Enter dimensions, then click on the floor plan to place your toilet, vanity, and shower rough-ins — the app figures out which wall each one faces and checks clearances automatically."*

**0:30–0:50 — Set budget and style**
On screen: drag the budget slider, pick a style preset (e.g. Minimalist Modern). Let it solve.
Say: *"Set a budget and a style, and a constraint solver checks every product in the catalog against your room's real geometry and your spend — then hands back three ready-made bundles."*

**0:50–1:10 — Show the results**
On screen: click through Value / Balanced / Premium tabs; show the floor plan with fixtures laid out; scroll the bundle summary and point at one rationale line.
Say: *"Value, Balanced, and Premium — each one fully priced, laid out on your actual floor plan, and every item comes with a plain-language reason it was picked, not just a price tag."*

**1:10–1:20 — Sustainability beat**
On screen: point at the "Water efficiency" line in the bundle summary.
Say: *"Every bundle also carries a water-efficiency score, so sustainability isn't an afterthought — it's built into how the bundle gets picked."*

**1:20–1:45 — Conversational refinement**
On screen: type "swap the vanity for something cheaper" into chat, hit send, show the reply and the updated price/rationale.
Say: *"And if you don't like a pick, just say so. Chat with it in plain language — swap a fixture, change your budget — and it re-solves live and explains exactly what changed."*

**1:45–2:00 — Close**
On screen: cut back to the full page, then show the GitHub URL.
Say: *"Bath Planner is live, fully tested, and built end-to-end through an AI-assisted, spec-first development process. That's Bath Planner."*

---

## If you need to cut to ~90 seconds

Drop the **sustainability beat (1:10–1:20)** and shorten the **results beat (0:50–1:10)** to a single tier instead of clicking through all three. The room-description and chat-refinement beats are the two moments that most directly demonstrate "Approach & Innovation" and "UX & Feasibility" — keep those intact.

## Known rough edge to avoid on camera

The chat's swap-reply text currently ends with a doubled period (a small unfixed cosmetic bug — see project notes). If it's visible in your take and bothers you, trim that frame slightly tighter or fix the bug first; it's a one-line change in `chat-orchestration.ts`.
