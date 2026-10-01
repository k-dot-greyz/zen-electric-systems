'use strict';
// Branch physics sad path — unknown material fails closed with jurisdiction hint.
// Run: node tests/run-branch-physics-edge-tests.js

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { calculateBranchLoad } = require('../engine/js/branch-physics');

const fixture = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'fixtures/branch-riga119-workstation.json'), 'utf8')
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

run('unknown branch material throws with known materials list', () => {
  const branch = { ...fixture.branch, material: 'PLATINUM_FOIL' };
  let threw = false;
  try {
    calculateBranchLoad(branch, fixture.physicsConstants);
  } catch (err) {
    threw = true;
    assert.match(err.message, /no entry in this jurisdiction/);
    assert.match(err.message, /ALUMINUM|COPPER/);
  }
  assert.strictEqual(threw, true);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
