# zen-electric-systems

Electrical safety audit / compliance / diagnostic tooling. Domain
logic lives as data (`rules/`, `schemas/`); code (`engine/`) is a
thin, disposable evaluator over that data. See `docs/ARCHITECTURE.md`
for the full sketch and rationale.

First driver: VoltWatch, a post-Soviet residential electrical audit
tool. `implementations/voltwatch-html/` tracks its integration status
honestly — read that README before assuming the original artifact is
fixed.

## Status: init pass, not a finished product

What exists and is proven by fixture tests:
- `schemas/` — manifest, fault-tree card grammar, jurisdiction pack (JSON Schema draft 2020-12)
- `rules/jurisdictions/lv-baltic-panel.json` — VoltWatch's hardcoded physics constants + standards list, now swappable data
- `rules/fault-trees/voltage-probe-4point.json` v1.1.0 — migrated diagnostic logic, **with a real bug fixed**: v2.0's original catch-all silently labeled any unmatched reading as "verified clean," including readings that were neither a known hazard nor actually clean (see `tests/fixtures/gap-case.json`). v1.1.0 adds an explicit `VERIFIED_CLEAN_GROUND` condition and an `INDETERMINATE_MANUAL_INSPECTION_REQUIRED` terminal card instead.
- `engine/js/` — pure-function evaluator + branch physics calculator, no eval, no DOM, no dependencies
- `tests/` — 8 fault-tree fixtures (5 regression from VoltWatch's original archetypes, 3 new proving the gap fix) + 1 branch-physics fixture, hand-derived and cross-checked
- `bin/zes.js` — CLI leaf (`zes test` / `zes diagnose` / `zes validate`). File I/O stays here so `engine/js` stays dependency-free.

What's stubbed, deliberately:
- `engine/py/`, `engine/rs/` — no code until a real caller needs them
- `implementations/voltwatch-html/` — the original artifact is not yet rewired to call this core; see its README

What's still open (your call, not mine):
- Whether `fault-tree.schema.json` should be a specialization of your existing JSON-card everything-engine format, or stand alone. Written standalone for now — see `docs/ARCHITECTURE.md` Section 7.
- Whether jurisdiction packs should be allowed to override fault-tree conditions, only append, or both.

## Setup

Needs Node 18+ (`.nvmrc` pins **20**; `package.json` `engines` allows `>=18`).

```
npm install
```

That installs the pinned `ajv@8.20.0` devDependency used only by schema validation. `engine/js` has zero runtime deps — `ajv` is validate-only.

## Everyday commands

```
npm test              # fault-tree + branch-physics + schema validate
npm run diagnose -- --fixture tests/fixtures/true-clean.json
npx zes diagnose --readings '{"ln":230,"lpe":230,"npe":0,"radiator":0}'

# Still work if you hate npm scripts:
node tests/run-fault-tree-tests.js
node tests/run-branch-physics-tests.js
node tests/validate-schemas.js
```

`npx zes help` prints the same surface (`test`, `validate`, `diagnose`). Diagnose defaults `bootlegContinuity` to `false` when omitted from `--readings`.

## Still open (pick up here)

- [ ] Decide the fault-tree-schema-specialization question (Section 7.4)
- [ ] Decide jurisdiction override semantics (Section 7.3)
- [ ] Patch `implementations/voltwatch-html/` per its README
- [ ] Add a second jurisdiction pack (proves "agnostic" isn't just a label) once a second real site/context exists
