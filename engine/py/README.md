# engine/py — not yet implemented

Intentional stub, not an oversight. Per ARCHITECTURE.md Section 3: no
engine gets built here until a real caller shows up (CLI batch auditor,
CI check, agent tool call). Building three language engines against
zero consumers is the same failure mode as hardcoding, in reverse.

`engine/js/` is the reference implementation. Porting to Python is a
mechanical translation of `fault-tree-evaluator.js` and
`branch-physics.js` — both are pure functions with no DOM/DOM-adjacent
dependencies, by design, specifically so this port is cheap when it's
actually needed.
