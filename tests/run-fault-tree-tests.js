'use strict';
// No test framework dependency — plain Node + built-in assert.
// Run: node tests/run-fault-tree-tests.js

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { evaluateFaultTree } = require('../engine/js/fault-tree-evaluator');

const ruleSet = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../rules/fault-trees/voltage-probe-4point.json'), 'utf8')
);

const fixturesDir = path.join(__dirname, 'fixtures');
const fixtureFiles = fs.readdirSync(fixturesDir).filter((f) => {
  if (!f.endsWith('.json')) return false;
  const content = JSON.parse(fs.readFileSync(path.join(fixturesDir, f), 'utf8'));
  // Fault-tree fixtures have this shape; other fixture kinds (e.g. branch-physics) don't — skip them here rather than fail on a shape mismatch.
  return 'input' in content && 'expectedVerdictCode' in content;
});

let passed = 0;
let failed = 0;

for (const file of fixtureFiles) {
  const fixture = JSON.parse(fs.readFileSync(path.join(fixturesDir, file), 'utf8'));
  try {
    const result = evaluateFaultTree(ruleSet, fixture.input);
    assert.strictEqual(
      result.verdict.code,
      fixture.expectedVerdictCode,
      `${file}: expected ${fixture.expectedVerdictCode}, got ${result.verdict.code}`
    );
    console.log(`PASS  ${file.padEnd(36)} -> ${result.verdict.code}`);
    passed++;
  } catch (err) {
    console.log(`FAIL  ${file.padEnd(36)} -> ${err.message}`);
    failed++;
  }
}

console.log(`\n${passed} passed, ${failed} failed (of ${fixtureFiles.length} fixtures)`);
if (failed > 0) process.exit(1);
