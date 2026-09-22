'use strict';
// Run: node tests/run-branch-physics-tests.js

const fs = require('fs');
const path = require('path');
const { calculateBranchLoad } = require('../engine/js/branch-physics');

const fixture = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'fixtures/branch-riga119-workstation.json'), 'utf8')
);

const result = calculateBranchLoad(fixture.branch, fixture.physicsConstants);
const tol = fixture.tolerance;

let passed = 0;
let failed = 0;

for (const [key, expected] of Object.entries(fixture.expected)) {
  const actual = result[key];
  let ok;
  if (typeof expected === 'boolean') {
    ok = actual === expected;
  } else {
    ok = Math.abs(actual - expected) <= tol;
  }
  if (ok) {
    console.log(`PASS  ${key.padEnd(24)} expected ${expected}, got ${actual}`);
    passed++;
  } else {
    console.log(`FAIL  ${key.padEnd(24)} expected ${expected}, got ${actual}`);
    failed++;
  }
}

console.log(`\n${passed} passed, ${failed} failed (of ${Object.keys(fixture.expected).length} fields, tolerance ${tol})`);
if (failed > 0) process.exit(1);
