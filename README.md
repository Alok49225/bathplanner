# Bath Planner

An AI-assisted bathroom designer & planner, built as a KOHLER case-study prototype. Given a room's dimensions, a budget, and a style preference, it runs a constraint solver over a real product catalog to generate three physically-valid, explainable bathroom bundles — then lets you refine the result by clicking directly on a floor plan or by asking for changes in plain English.

**Live demo:** https://kohlerbathplanner.vercel.app

## What it does

- **Describe the room** — width, length, ceiling height, doors, windows — then place toilet, vanity, and shower rough-ins either by typing exact coordinates or by clicking directly on the rendered floor plan.
- **Get three real bundles** — Value / Balanced / Premium — generated from an actual constraint solver, not placeholder data: every fixture is checked against the room's physical clearances before it's ever shown, budget is never exceeded, and every pick comes with a plain-language reason ("the most affordable option that still coordinates," "the best water efficiency in this category").
- **See it, not just read it** — a scaled floor plan with fixture footprints, clearance-warning overlays, and a scale reference, so "does this actually fit" is visible, not just asserted.
- **Refine it by chat** — "increase my budget by $500," "keep the vanity," "swap the toilet for something cheaper" all trigger the same solver the form does. Unclear or out-of-scope requests get a helpful, specific response instead of a silent failure or a guessed answer.
- **Export it** — print or save the floor plan, fixtures, and price breakdown as a PDF.

## Why it's built this way — a note on the "AI" in this design

Every "smart" behavior in this app — the constraint solver, the chat's intent recognition, the rationale text — is **deterministic**, not a live LLM call. That's a deliberate reliability choice, not an oversight: it means the prototype runs identically every time, needs no API key or network dependency, and every one of its 300+ automated tests is fully repeatable. The chat layer in particular is architected so a real model could be dropped in later (the intent-parsing step is fully isolated from the solver it drives) without touching the underlying engine — see the Prompts Documentation for the fuller reasoning and where a model would extend this today.

## Architecture

The codebase is organized into four layers, with dependencies pointing one direction only:

```
Presentation  →  Application  →  Domain  ←  Infrastructure
```

- **`src/domain/`** — the actual bathroom-design logic, with zero dependency on React or the DOM. `domain/types/` defines the core schemas (Product, Room, Bundle); `domain/engine/` holds the solver itself: compatibility filtering, budget-constrained selection, multi-objective scoring (aesthetic fit, water efficiency, finish coherence), clearance/fit validation, tier generation, pin-and-resolve, rationale generation, and the chat intent parser.
- **`src/application/`** — orchestration hooks that turn UI state into solver calls: session state (guest mode, `sessionStorage`-backed), the debounced intake→solve pipeline, and the chat→solver wiring.
- **`src/infrastructure/`** — the concrete product catalog (42 real Kohler-style SKUs, generated from a spreadsheet into a static JSON file at build time), implementing a `CatalogRepository` interface the Domain layer defines but never depends on directly.
- **`src/presentation/`** — every UI component, organized by workstream: `intake/` (room/budget/style form), `viz/` (floor plan, fixture placement, tier switcher), `output/` (bundle summary, PDF export), `chat/` (the chat panel itself).

A full architecture diagram is included at [`architecture-diagram.html`](./architecture-diagram.html).

## Tech stack

- **React 19 + TypeScript**, built with **Vite**
- **Vitest + React Testing Library** for testing — 300+ tests, all deterministic, no network calls
- No backend, no database — fully static, runs entirely in the browser (guest-mode state lives in `sessionStorage` only)
- No external API keys required to run or build

## Getting started

Requires **Node.js 20 or later**.

```bash
git clone https://github.com/Alok49225/kohlerbathplanner.git
cd kohlerbathplanner
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
    intake/            room/budget/style form, click-to-place plumbing
    viz/                floor plan, fixture placement, tier switcher
    output/             bundle summary, PDF export
    chat/                the chat panel
catalog/               spreadsheet source + build scripts for the product catalog
```

## Testing

```bash
npm run test
```

Every layer is tested at the level it makes sense to: the solver and chat parser have pure unit tests against real catalog-shaped data (no mocking the engine itself); UI components are tested with React Testing Library, verifying real rendered output rather than implementation details.
