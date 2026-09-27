# Bath Planner

An AI-assisted bathroom designer & planner, built as a case-study prototype. Given a room's dimensions, a budget, and a style preference, it runs a constraint solver over a real product catalog to generate three physically-valid, explainable bathroom bundles — then lets you refine the result by clicking directly on a floor plan or by asking for changes in plain English.

**Live demo:** https://kohlerbathplanner.vercel.app

**Submission materials:** [Prompts & Workflow Documentation](./docs/prompts-documentation.pdf) · [Presentation Deck](./docs/presentation-deck.pdf) · [Video Demonstration](./docs/bath-planner-demo.mp4) · [New Features Demo (silent, 21s)](./docs/new-features-demo.mp4)

## What it does

- **Describe the room** — width, length, ceiling height, doors, windows — then either click **Auto-place fixtures** to have a deterministic search place the toilet, vanity, and shower for you (avoiding doors, windows, and each other's clearance), or place rough-ins yourself by typing exact coordinates or clicking directly on the floor plan. If a room genuinely can't fit everything, a fixed fallback ladder drops the vanity, then the shower, before ever giving up — and explains exactly why in the bundle summary.
- **Get three real bundles** — Value / Balanced / Premium — generated from an actual constraint solver, not placeholder data: every fixture is checked against the room's physical clearances before it's ever shown, budget is never exceeded, and every pick comes with a plain-language reason ("the most affordable option that still coordinates," "the best water efficiency in this category").
- **Pick a different product yourself** — a "Change" button on any line item opens every eligible option for that category, sorted by price, so you're not stuck with the solver's own pick if you'd rather choose directly.
- **See it, not just read it** — a scaled floor plan with fixture footprints, clearance-warning overlays, a scale reference, and a floor color/material that follows your chosen style (matte white tile, marble, or wood), so "does this actually fit, and does it feel like my style" is visible, not just asserted.
- **Refine it by chat** — "increase my budget by $500," "keep the vanity," "swap the toilet for something cheaper" all trigger the same solver the form does. Unclear or out-of-scope requests get a helpful, specific response instead of a silent failure or a guessed answer.
- **Export it** — print or save the floor plan, fixtures, and price breakdown as a PDF.

## Why it's built this way — a note on the "AI" in this design

Every "smart" behavior in this app — the constraint solver, the automatic fixture placement, the chat's intent recognition, the rationale text — is **deterministic**, not a live LLM call. That's a deliberate reliability choice, not an oversight, made independently twice for two unrelated features: it means the prototype runs identically every time, needs no API key or network dependency, and every one of its 380+ automated tests is fully repeatable. The chat layer in particular is architected so a real model could be dropped in later (the intent-parsing step is fully isolated from the solver it drives) without touching the underlying engine — see the [Prompts Documentation](./docs/prompts-documentation.pdf) for the fuller reasoning and where a model would extend this today.

## Architecture

The codebase is organized into four layers, with dependencies pointing one direction only:

```
Presentation  →  Application  →  Domain  ←  Infrastructure
```

- **`src/domain/`** — the actual bathroom-design logic, with zero dependency on React or the DOM. `domain/types/` defines the core schemas (Product, Room, Bundle); `domain/engine/` holds the solver itself: automatic fixture placement (a deterministic candidate search with a fixed fallback ladder for tight rooms), compatibility filtering, budget-constrained selection, multi-objective scoring (aesthetic fit, water efficiency, finish coherence), clearance/fit validation (including door-swing and window avoidance), tier generation, pin-and-resolve, rationale generation, and the chat intent parser.
- **`src/application/`** — orchestration hooks that turn UI state into solver calls: session state (guest mode, `sessionStorage`-backed), the debounced intake→solve pipeline, and the chat→solver wiring (also used by the product picker's "select this exact product" action).
- **`src/infrastructure/`** — the concrete product catalog (42 real Kohler-style SKUs, generated from a spreadsheet into a static JSON file at build time), implementing a `CatalogRepository` interface the Domain layer defines but never depends on directly.
- **`src/presentation/`** — every UI component, organized by workstream: `intake/` (room/budget/style form, click-to-place or auto-place plumbing), `viz/` (floor plan with theme-matched flooring, fixture placement, tier switcher), `output/` (bundle summary, the product picker, PDF export), `chat/` (the chat panel itself).

A full architecture diagram is included at [`architecture-diagram.html`](./architecture-diagram.html).

## Tech stack

- **React 19 + TypeScript**, built with **Vite**
- **Vitest + React Testing Library** for testing — 380+ tests, all deterministic, no network calls
- No backend, no database — fully static, runs entirely in the browser (guest-mode state lives in `sessionStorage` only)
- No external API keys required to run or build

## Getting started

Requires **Node.js 20 or later**.

```bash
git clone https://github.com/Alok49225/bathplanner.git
cd bathplanner
npm install
npm run dev
```

Then open the URL Vite prints (typically `http://localhost:5173`).

### Other commands

```bash
npm run build      # type-check and build a production bundle into dist/
npm run preview    # serve that production build locally, to sanity-check it
npm run test       # run the full automated test suite
```

(`npm run lint` also exists, but its underlying tool currently requires Node ≥20.19 — it's optional tooling and isn't needed to run, build, or test the prototype.)

### Regenerating the product catalog (not needed to just run the app)

The committed catalog at `src/infrastructure/catalog/generated/catalog.json` is already built and ready to use. It's produced from `catalog/source.xlsx` — only regenerate it if you're changing the underlying SKU data:

```bash
npm run catalog:seed-source   # (re)writes catalog/source.xlsx from scratch, if needed
npm run catalog:build         # parses + validates source.xlsx into the generated JSON
```

## Project structure

```
src/
  domain/            core design logic — types + the solver engine, no UI dependency
    types/
    engine/
  application/        hooks wiring UI state to the solver (session state, intake, chat)
  infrastructure/     the concrete product catalog
    catalog/
  presentation/        all UI, by workstream
    intake/            room/budget/style form, click-to-place or auto-place plumbing
    viz/                floor plan (theme-matched flooring), fixture placement, tier switcher
    output/             bundle summary, product picker, PDF export
    chat/                the chat panel
catalog/               spreadsheet source + build scripts for the product catalog
```

## Testing

```bash
npm run test
```

Every layer is tested at the level it makes sense to: the solver and chat parser have pure unit tests against real catalog-shaped data (no mocking the engine itself); UI components are tested with React Testing Library, verifying real rendered output rather than implementation details.
