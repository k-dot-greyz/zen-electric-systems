#!/usr/bin/env node
'use strict';

/**
 * CLI leaf over engine/js. File I/O and argv live here so the evaluator
 * stays a pure function with zero runtime deps.
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { parseArgs } = require('util');
const { evaluateFaultTree } = require('../engine/js/fault-tree-evaluator');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_RULES = path.join(ROOT, 'rules', 'fault-trees', 'voltage-probe-4point.json');

const SUITES = [
  { name: 'fault-tree', rel: path.join('tests', 'run-fault-tree-tests.js') },
  { name: 'evaluator-edge', rel: path.join('tests', 'run-evaluator-edge-tests.js') },
  { name: 'branch-physics', rel: path.join('tests', 'run-branch-physics-tests.js') },
  { name: 'branch-physics-edge', rel: path.join('tests', 'run-branch-physics-edge-tests.js') },
  { name: 'zes-cli', rel: path.join('tests', 'run-zes-cli-tests.js') },
  { name: 'schemas', rel: path.join('tests', 'validate-schemas.js') },
];

const USAGE = `Usage: zes <command> [options]

Commands:
  test                 Run fault-tree + branch-physics + schema suites
  validate             Schema-validate jurisdiction + fault-tree packs
  diagnose [options]   Evaluate readings against a fault-tree
  help                 Show this usage

Diagnose options:
  --fixture <path>     Fixture JSON ({ input, expectedVerdictCode? })
  --readings <json>    Inline readings object
  --rules <path>       Fault-tree JSON (default: rules/fault-trees/voltage-probe-4point.json)

Examples:
  zes test
  zes validate
  zes diagnose --fixture tests/fixtures/true-clean.json
  zes diagnose --readings '{"ln":230,"lpe":230,"npe":0,"radiator":0}'

engine/js stays dependency-free. ajv is validate-only (devDependency).
`;

function isHelp(token) {
  return token === 'help' || token === '-h' || token === '--help';
}

function writeUsage(stream) {
  stream.write(USAGE);
}

function help() {
  writeUsage(process.stdout);
  process.exit(0);
}

function badUsage(message) {
  if (message) process.stderr.write(`${message}\n\n`);
  writeUsage(process.stderr);
  process.exit(2);
}

function runNodeScript(relPath) {
  const script = path.join(ROOT, relPath);
  return spawnSync(process.execPath, [script], {
    cwd: ROOT,
    stdio: 'inherit',
    env: process.env,
  });
}

function cmdTest() {
  let failed = false;
  for (const suite of SUITES) {
    process.stdout.write(`\n== ${suite.name} ==\n`);
    const result = runNodeScript(suite.rel);
    if (result.error) {
      process.stderr.write(`${suite.name}: ${result.error.message}\n`);
      failed = true;
      continue;
    }
    if (result.status !== 0) failed = true;
  }
  process.exit(failed ? 1 : 0);
}

function cmdValidate() {
  const result = runNodeScript(path.join('tests', 'validate-schemas.js'));
  if (result.error) {
    process.stderr.write(`${result.error.message}\n`);
    process.exit(1);
  }
  process.exit(result.status === 0 ? 0 : 1);
}

function loadJsonFile(filePath, label) {
  let raw;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    badUsage(`Cannot read ${label}: ${filePath}\n${err.message}`);
  }
  try {
    return JSON.parse(raw);
  } catch (err) {
    badUsage(`Invalid JSON in ${label}: ${filePath}\n${err.message}`);
  }
}

function parseReadingsJson(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    badUsage(`Invalid --readings JSON: ${err.message}`);
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    badUsage('--readings must be a JSON object');
  }
  return parsed;
}

function normalizeReadings(readings) {
  if ('bootlegContinuity' in readings) return readings;
  return { ...readings, bootlegContinuity: false };
}

function cmdDiagnose(argv) {
  if (argv.length === 1 && isHelp(argv[0])) help();

  let values;
  try {
    const parsed = parseArgs({
      args: argv,
      options: {
        fixture: { type: 'string' },
        readings: { type: 'string' },
        rules: { type: 'string' },
        help: { type: 'boolean', short: 'h' },
      },
      allowPositionals: false,
      strict: true,
    });
    values = parsed.values;
  } catch (err) {
    badUsage(err.message);
  }

  if (values.help) help();

  const hasFixture = values.fixture !== undefined;
  const hasReadings = values.readings !== undefined;
  if (hasFixture === hasReadings) {
    badUsage('diagnose requires exactly one of --fixture <path> or --readings <json>');
  }

  const rulesPath = path.resolve(values.rules ? values.rules : DEFAULT_RULES);
  const ruleSet = loadJsonFile(rulesPath, 'fault-tree');

  let readings;
  let expectedVerdictCode;
  if (hasFixture) {
    const fixturePath = path.resolve(values.fixture);
    const fixture = loadJsonFile(fixturePath, 'fixture');
    if (!fixture || typeof fixture !== 'object' || !('input' in fixture)) {
      badUsage(`Fixture ${fixturePath} has no "input" readings object`);
    }
    readings = fixture.input;
    if ('expectedVerdictCode' in fixture) expectedVerdictCode = fixture.expectedVerdictCode;
  } else {
    readings = parseReadingsJson(values.readings);
  }

  readings = normalizeReadings(readings);

  let result;
  try {
    result = evaluateFaultTree(ruleSet, readings);
  } catch (err) {
    process.stderr.write(`${err.message}\n`);
    process.exit(1);
  }

  const output = {
    cardId: result.cardId,
    verdict: result.verdict,
  };
  if (expectedVerdictCode !== undefined) {
    output.expectedVerdictCode = expectedVerdictCode;
    output.ok = result.verdict.code === expectedVerdictCode;
  }

  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  if (expectedVerdictCode !== undefined && !output.ok) process.exit(1);
  process.exit(0);
}

function main(argv) {
  const command = argv[0];
  if (isHelp(command) || command === undefined) {
    if (isHelp(command)) help();
    badUsage('Missing command.');
  }

  const rest = argv.slice(1);
  switch (command) {
    case 'test':
      return cmdTest();
    case 'validate':
      return cmdValidate();
    case 'diagnose':
      return cmdDiagnose(rest);
    default:
      badUsage(`Unknown command: ${command}`);
  }
}

main(process.argv.slice(2));
