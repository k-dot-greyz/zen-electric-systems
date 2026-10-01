# zen-electric-systems — Architecture Sketch (STUB — pre-redline)

Status: **DRAFT, unapproved.** No code, schema, or engine implementation
should be generated against this document until it survives review.

Rule 1 applies to this document too: if a section below is hand-wavy,
unproven, or hiding a gap, that gap is written down explicitly, not
smoothed over.

---

## 0. What this repo is for

Domain-specific vertical for electrical safety audit / compliance /
diagnostic tooling, sibling to the existing audio-engine and
JSON-card "everything engine" work. First concrete driver is VoltWatch
(post-Soviet residential electrical audit: branch load physics,
4-point voltage-probe fault diagnosis, PAT asset register, signed
compliance printout).

This repo is **not** "VoltWatch's source code." VoltWatch is the first
implementation. The repo's job is to hold the reusable, jurisdiction-
and-language-agnostic *domain logic*, so a second implementation
(CLI batch auditor, agent-callable tool, different building codebase
entirely — commercial, industrial, non-Baltic) doesn't require
re-deriving the fault tree or the physics from scratch inside a new
pile of HTML.

## 1. Core architectural bet

> Domain knowledge (electrician expertise, jurisdiction constants,
> hazard fault-trees) lives as **data**. Code is a thin, disposable
> evaluator over that data. Any renderer (browser HTML, CLI, agent
> tool call) is a leaf, not the trunk.

If this bet is wrong — if the fault-tree logic turns out to need
real branching/state that a flat rules format can't express cleanly —
that needs to surface here, explicitly, before schemas get written.
Current evidence from VoltWatch's `evaluateDiagnostics()`: the logic
IS a flat first-match-wins predicate list today. Open question: does
it stay that way as more fault conditions get added, or does it want
loops/memory (e.g. trend-over-time diagnostics, multi-reading
sessions)? **Unresolved — flagging, not assuming.**

## 2. Four capability modules (decoupled, independently testable)

### 2.1 Branch Physics
Conductor material/cross-section/length → resistivity, voltage drop,
I²R heat loss, continuous-load derate (80% rule), overload/trip
thresholds. Pure function of (branch spec, appliance load list,
jurisdiction constants). No jurisdiction-specific number
(resistivity, derate %, wire gauge tables) hardcoded in engine code —
all sourced from a jurisdiction data file.

**Known-good today (from VoltWatch, carried over as-is):**
- Al ρ = 0.0282, Cu ρ = 0.0175 Ω·mm²/m
- 80% continuous-load breaker derate
- loop resistance = ρ × (2 × length) / cross-section

These become *default jurisdiction values*, not engine constants.

### 2.2 Diagnostic Fault Tree
Ordered list of `(predicate over readings) → (verdict, severity,
action, standard reference)`. First match wins. Evaluator is
generic; the actual conditions (bootleg ground, floating earth,
energized plumbing, clean TN-S) are data in `rules/fault-trees/`.

**Known gap, inherited from VoltWatch, must be closed before this
module is trusted:** the current four conditions have an unverified
boundary. Bootleg-ground condition and floating-earth condition each
constrain `lpe` and `npe` from different directions; whether every
possible (ln, lpe, npe, radiator) tuple lands in exactly one bucket,
or whether there's a reachable gap/overlap, has not been proven.
This must be a fixture-based test question, not a "looks right"
question — noted here so it isn't lost.

### 2.3 Asset Register (PAT / EN 50699-shaped)
Flat schema: id, description, appliance class, Rpe, Riso, leakage,
pass/fail. Not much domain logic here beyond field validation —
mostly a schema + CRUD concern. Lowest-risk module.

### 2.4 Compliance Artifact / Sign-off
Produces the printable/exportable audit record: manifest snapshot,
digest, signature. **This module carries the integrity requirement**
described in Section 4 below — it is the one place a fabricated
value would do real harm (a signed printout someone files as a
legal compliance record).

## 3. Portable core, disposable renderer

Per decision: rules are data, the JS in VoltWatch is a renderer, not
the source of truth. Target shape:

```
schemas/        → JSON Schema for manifest, fault-tree cards, jurisdiction data
rules/          → the actual fault-trees, physics constants, jurisdiction packs (data, not code)
engine/         → pure logic, evaluates rules against a manifest, zero DOM/UI
  js/           → reference implementation + what VoltWatch's UI calls into
  py/           → stub — CLI/batch audits, CI checks, agent tool calls
  rs/           → stub — future, only if a real caller shows up (mycelium-adjacent?)
implementations/→ actual UIs/renderers; voltwatch-html is one of these, not special
tests/          → fixtures + explicit boundary-case tests (see 2.2 gap)
```

**Explicit non-goal:** building out `py/` or `rs/` engines before
there's a real caller for them. Stub the directory + a README saying
"not yet implemented, see js/ for reference behavior" and stop there.
Building three engines against zero consumers is the inverse failure
mode of hardcoding — implementation-agnostic until it's actually
inconvenient to not have picked one, per your own doctrine.

## 4. Integrity requirement (non-negotiable, blocks module 2.4)

Any field in an exported/printed compliance artifact named or
labeled as a hash, digest, checksum, or signature MUST be one of:

(a) a real, correctly-computed digest, using an algorithm the schema
    names explicitly (e.g. actual SHA-256 via SubtleCrypto in
    browser contexts, hashlib in Python), or

(b) explicitly marked `"integrity_status": "MOCK — not cryptographically
    valid"` and rendered as visibly mock in every output surface
    (print, PDF, JSON export) — no exceptions for "it'll get fixed
    later."

This closes the specific failure found in VoltWatch v2.0-agnostic:
a 32-bit JS string hash concatenated with a hardcoded fake tail to
visually resemble a SHA-256 digest on a document meant to be signed
and filed as a safety record. That is not a rendering bug — it is a
fabricated audit trail, and the schema itself must make that
un-reproducible, not just a coding-standard reminder that can be
skipped under deadline pressure.

## 5. Jurisdiction as data, not literal

Current VoltWatch has `standards: ['LVS_EN_50110_1', 'EN_50699',
'OSHA_1910_S', 'IEC_60364']` as a hardcoded array on every manifest,
regardless of site. Target: a `jurisdictions/*.json` pack per
regulatory context (e.g. `lv-lvs-en.json`, `us-nec-osha.json`) that
supplies both the standards-reference list AND the physics constants
(Section 2.1) AND any jurisdiction-specific fault-tree variants
(e.g. is "zануление"/bootleg-neutral-ground even a locally relevant
fault mode in a NEC/GFCI-first jurisdiction? Probably not — this
should be swappable, not universal).

## 6. Schema versioning

Manifest schema must carry `schemaVersion` and loaders must check
**equality against a supported version (or run through an explicit
migration function)**, not truthy-check presence. VoltWatch's current
`loadManifestFromLocalStorage` accepts any manifest with a
`schemaVersion` field regardless of value — silent desync risk,
called out for closure at schema-design time.

## 7. Open questions

1. ~~Fault-tree boundary completeness (2.2)~~ — **RESOLVED, closed with proof.** The suspected gap was real: readings like `lpe=200V, npe=15V` (relative to `ln=230V`) matched none of the three named hazard conditions in VoltWatch v2.0's original logic and fell through an unconditional `else` labeled "VERIFIED: PROPERLY EARTHED SYSTEM." `rules/fault-trees/voltage-probe-4point.json` v1.1.0 replaces the implicit catch-all with an explicit `VERIFIED_CLEAN_GROUND` condition and an `INDETERMINATE_MANUAL_INSPECTION_REQUIRED` terminal card. See `tests/fixtures/gap-case.json` for the failing case and `tests/run-fault-tree-tests.js` for the passing suite (8/8, including 5 regression fixtures reconstructed from VoltWatch's original archetype presets — none of which, notably, exercised the clean or floating-earth paths at all).
2. Does the fault-tree stay flat forever, or does some future diagnostic need session/trend state? — **Still open.** Current implementation (`engine/js/fault-tree-evaluator.js`) is stateless first-match-wins; nothing built yet assumes otherwise.
3. Should jurisdiction packs be allowed to *add* fault-tree conditions, override them, or both? — **Still open**, deferred until a second jurisdiction pack with a genuinely different fault profile exists (see README's init-ritual checklist).
4. Is `fault-tree.schema.json` a specialization of the JSON-card everything-engine format, or a sibling grammar? — **Still open, your call.** Written standalone for now (`schemas/fault-tree.schema.json`), using a structured predicate DSL (`all`/`any`/`not`/`cmp`/`between`, with `{"param": name}` and `{"field": name, "offset": ...}` value references) deliberately instead of eval — since a fault-tree pack is data that could come from a jurisdiction source you didn't personally write, it should never be able to execute code.

---

*Next step per doc-before-code: this file gets redlined by G. No
schema or engine code is generated from it until it's approved or
explicitly marked "good enough to build against, gaps tracked in
Section 7."*
