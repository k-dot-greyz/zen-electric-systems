'use strict';
// Dev-time schema check. ajv is a pinned devDependency (draft 2020-12 via ajv/dist/2020).
// Not a runtime dependency of engine/js — see package.json.

const fs = require('fs');
const path = require('path');

let Ajv2020;
try {
  Ajv2020 = require('ajv/dist/2020'); // schemas declare draft 2020-12; ajv's default export only supports draft-07
} catch (err) {
  console.error('ajv is missing. Run `npm install` (ajv is a pinned devDependency, not --no-save).');
  console.error(err.message);
  process.exit(1);
}

const ajv = new Ajv2020({ strict: false });

function load(p) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, '..', p), 'utf8'));
}

const checks = [
  { schema: 'schemas/jurisdiction.schema.json', data: 'rules/jurisdictions/lv-baltic-panel.json' },
  { schema: 'schemas/fault-tree.schema.json', data: 'rules/fault-trees/voltage-probe-4point.json' }
];

let ok = true;
for (const { schema, data } of checks) {
  try {
    const validate = ajv.compile(load(schema));
    const valid = validate(load(data));
    if (valid) {
      console.log(`PASS  ${data} validates against ${schema}`);
    } else {
      console.log(`FAIL  ${data} does NOT validate against ${schema}`);
      console.log(JSON.stringify(validate.errors, null, 2));
      ok = false;
    }
  } catch (e) {
    console.log(`ERROR compiling ${schema}: ${e.message}`);
    ok = false;
  }
}
process.exit(ok ? 0 : 1);
