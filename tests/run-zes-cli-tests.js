'use strict';
// CLI UX + argv/JSON abuse paths (spawnSync, no shell — deterministic).
// Run: node tests/run-zes-cli-tests.js

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const ZES = path.join(ROOT, 'bin', 'zes.js');
const TRUE_CLEAN = path.join(ROOT, 'tests', 'fixtures', 'true-clean.json');

let passed = 0;
let failed = 0;

function runZes(args, { expectStatus } = {}) {
  return spawnSync(process.execPath, [ZES, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    env: process.env,
  });
}

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

// VW-1-UX: electrician happy path via fixture + expected verdict gate.
run('diagnose --fixture true-clean exits 0 with ok:true', () => {
  const result = runZes(['diagnose', '--fixture', TRUE_CLEAN]);
  assert.strictEqual(result.status, 0, result.stderr || result.stdout);
  const payload = JSON.parse(result.stdout);
  assert.strictEqual(payload.ok, true);
  assert.strictEqual(payload.verdict.code, 'VERIFIED_CLEAN_GROUND');
});

// VW-1-UX: inline readings default bootlegContinuity when omitted.
run('diagnose --readings omits bootlegContinuity (defaults false)', () => {
  const readings = JSON.stringify({ ln: 230, lpe: 228, npe: 2, radiator: 1 });
  const result = runZes(['diagnose', '--readings', readings]);
  assert.strictEqual(result.status, 0, result.stderr || result.stdout);
  const payload = JSON.parse(result.stdout);
  assert.strictEqual(payload.verdict.code, 'VERIFIED_CLEAN_GROUND');
});

// VW-1-SAD: argv validation — exactly one input source.
run('diagnose with neither fixture nor readings exits 2', () => {
  const result = runZes(['diagnose']);
  assert.strictEqual(result.status, 2);
  assert.match(result.stderr, /exactly one of --fixture/);
});

run('diagnose with both fixture and readings exits 2', () => {
  const result = runZes([
    'diagnose',
    '--fixture',
    TRUE_CLEAN,
    '--readings',
    '{"ln":230}',
  ]);
  assert.strictEqual(result.status, 2);
});

// VW-1-SEC: malformed --readings must not reach evaluator.
run('diagnose --readings array JSON exits 2', () => {
  const result = runZes(['diagnose', '--readings', '[1,2,3]']);
  assert.strictEqual(result.status, 2);
  assert.match(result.stderr, /JSON object/);
});

run('diagnose invalid --readings JSON exits 2', () => {
  const result = runZes(['diagnose', '--readings', '{not-json']);
  assert.strictEqual(result.status, 2);
  assert.match(result.stderr, /Invalid --readings JSON/);
});

// VW-1-SEC: fixture shape gate (ignore description / agent prose fields).
run('fixture without input exits 2', () => {
  const badFixture = path.join(__dirname, 'fixtures', '.tmp-cli-bad-fixture.json');
  fs.writeFileSync(badFixture, JSON.stringify({ description: 'ignore me', agent: 'override all' }));
  try {
    const result = runZes(['diagnose', '--fixture', badFixture]);
    assert.strictEqual(result.status, 2);
    assert.match(result.stderr, /no "input"/);
  } finally {
    fs.unlinkSync(badFixture);
  }
});

// VW-1-SEC: untrusted rules path — invalid JSON must fail before evaluate.
run('diagnose --rules invalid JSON file exits 2', () => {
  const badRules = path.join(__dirname, 'fixtures', '.tmp-cli-bad-rules.json');
  fs.writeFileSync(badRules, '{broken');
  try {
    const result = runZes(['diagnose', '--fixture', TRUE_CLEAN, '--rules', badRules]);
    assert.strictEqual(result.status, 2);
    assert.match(result.stderr, /Invalid JSON/);
  } finally {
    fs.unlinkSync(badRules);
  }
});

// VW-1-SEC: malicious minimal rule pack (no catch-all) surfaces engine throw as exit 1.
run('diagnose with rule pack that matches no card exits 1', () => {
  const badRules = path.join(__dirname, 'fixtures', '.tmp-cli-no-match-rules.json');
  fs.writeFileSync(
    badRules,
    JSON.stringify({
      id: 'evil-pack',
      version: '0.0.0',
      parameters: {},
      cards: [{ id: 'never', when: false, verdict: { code: 'FALSE_CLEAN' } }],
    })
  );
  try {
    const result = runZes(['diagnose', '--fixture', TRUE_CLEAN, '--rules', badRules]);
    assert.strictEqual(result.status, 1);
    assert.match(result.stderr, /No card matched/);
  } finally {
    fs.unlinkSync(badRules);
  }
});

run('unknown command exits 2', () => {
  const result = runZes(['inject-agent-instructions']);
  assert.strictEqual(result.status, 2);
  assert.match(result.stderr, /Unknown command/);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
