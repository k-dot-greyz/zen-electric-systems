# implementations/voltwatch-html — not yet populated

Honest status: this pass built the portable core (schemas/, rules/,
engine/js/, tests/) and proved it against fixtures derived from the
original VoltWatch manifest and diagnostic logic. It did **not** yet
patch the original uploaded HTML artifact itself.

The original file still has, unpatched:
- the fabricated SHA-256 display (real 32-bit hash + hardcoded fake
  tail string) — this is the integrity violation described in
  ARCHITECTURE.md Section 4 and must be fixed before this artifact
  is treated as a real implementation, not just fixed "eventually"
- a truthy-only schemaVersion check on load
- inline hardcoded fault-tree conditions and physics constants that
  should be replaced with calls into `engine/js/` against
  `rules/fault-trees/voltage-probe-4point.json` and
  `rules/jurisdictions/lv-baltic-panel.json`

Next step, when you want it: rewire the HTML's `evaluateDiagnostics()`
and `recalculateLoad()` to call the engine functions instead of
containing the logic inline, and fix the hash display to either
compute a real SHA-256 (SubtleCrypto is available in-browser) or
render an explicit `MOCK — not cryptographically valid` label. Didn't
do this unprompted since it's a real behavior change to a file you
uploaded, not a net-new stub.
