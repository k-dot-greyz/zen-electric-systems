'use strict';
// One-off validation: do our own schemas parse, and does real data pass them?
// Not part of the permanent suite (ajv isn't a committed dependency yet — see note at bottom).

const Ajv2020 = require('ajv/dist/2020'); // schemas declare draft 2020-12; ajv's default export only supports draft-07
const fs = require('fs');
const path = require('path');

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
