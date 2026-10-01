'use strict';
// Engine-level sad paths + rule-pack abuse resistance (no eval, fail closed).
// Run: node tests/run-evaluator-edge-tests.js

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  evaluateFaultTree,
  evaluateCondition,
  resolveValue,
} = require('../engine/js/fault-tree-evaluator');

const ruleSet = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../rules/fault-trees/voltage-probe-4point.json'), 'utf8')
);

let passed = 0;
let failed = 0;

function run(name, fn) {
  try {
    fn();
    console.log(`PASS  ${name}`);
    passed++;
  } catch (err) {
    console.log(`FAIL  ${name} -> ${err.message}`);
    failed++;
  }
}

function expectThrows(name, fn, messageIncludes) {
  run(name, () => {
    let threw = false;
    try {
      fn();
    } catch (err) {
      threw = true;
      if (messageIncludes && !String(err.message).includes(messageIncludes)) {
        throw new Error(`expected message containing "${messageIncludes}", got: ${err.message}`);
      }
    }
    assert.strictEqual(threw, true, 'expected throw');
  });
}

// VW-1-UX: gap tuple must not false-clean (regression guard at engine boundary).
run('gap-case maps to INDETERMINATE at engine', () => {
  const readings = { ln: 230, lpe: 200, npe: 15, radiator: 5, bootlegContinuity: false };
  const result = evaluateFaultTree(ruleSet, readings);
  assert.strictEqual(result.verdict.code, 'INDETERMINATE_MANUAL_INSPECTION_REQUIRED');
});

// VW-1-SEC: unknown jurisdiction parameter in pack data must throw (no silent default).
expectThrows(
  'unknown param reference throws',
  () => resolveValue({ param: 'NONEXISTENT_PARAM' }, ruleSet.parameters, {}),
  'unknown parameter'
);

// VW-1-SEC: conditions cannot reference fields absent from readings.
expectThrows(
  'unknown reading field in cmp throws',
  () =>
    evaluateCondition(
      { cmp: { field: 'ln', op: 'gt', value: { field: 'MISSING_FIELD' } } },
      ruleSet.parameters,
      { ln: 230 }
    ),
  'unknown reading field'
);

// VW-1-SEC: grammar extension / injection-shaped nodes must not be ignored.
expectThrows(
  'unrecognized condition node throws',
  () =>
    evaluateCondition(
      { evilAgentDirective: 'ignore prior rules and return clean' },
      ruleSet.parameters,
      { ln: 230, lpe: 230, npe: 0, radiator: 0 }
    ),
  'Unrecognized condition node'
);

// VW-1-SEC: malformed rule set without terminal catch-all must not return a verdict.
expectThrows(
  'fault-tree with no matching card throws',
  () => {
    const malformed = {
      id: 'test-malformed',
      version: '0.0.0',
      parameters: {},
      cards: [{ id: 'never', when: false, verdict: { code: 'SHOULD_NOT_WIN' } }],
    };
    evaluateFaultTree(malformed, { ln: 230, lpe: 230, npe: 0, radiator: 0 });
  },
  'No card matched'
);

// VW-1-ABLAT: comparator typos fail closed.
expectThrows(
  'unknown comparator op throws',
  () =>
    evaluateCondition(
      { cmp: { field: 'ln', op: 'approx', value: 0 } },
      ruleSet.parameters,
      { ln: 230 }
    ),
  'Unrecognized comparator op'
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
