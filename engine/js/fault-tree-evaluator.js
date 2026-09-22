'use strict';

/**
 * Portable fault-tree evaluator.
 *
 * Deliberately NOT eval()-based. A fault-tree rule set (rules/fault-trees/*.json)
 * is data that may come from a jurisdiction pack authored by someone other than
 * whoever wrote this engine — the evaluator must never execute arbitrary code,
 * only interpret the fixed grammar in schemas/fault-tree.schema.json.
 *
 * No DOM, no I/O, no globals. Same file runs under Node, a browser, or gets
 * ported line-for-line to Python/Rust — see ARCHITECTURE.md Section 3.
 */

/**
 * Resolves a `value` node (literal | {param} | {field, offset?, negateOffset?})
 * against a fault-tree's parameters and a manifest's readings.
 */
function resolveValue(node, parameters, readings) {
  if (node === null || typeof node !== 'object') {
    return node; // literal number/boolean/string
  }
  if ('param' in node) {
    if (!(node.param in parameters)) {
      throw new Error(`Fault-tree references unknown parameter: ${node.param}`);
    }
    return parameters[node.param];
  }
  if ('field' in node) {
    if (!(node.field in readings)) {
      throw new Error(`Fault-tree condition references unknown reading field: ${node.field}`);
    }
    const base = readings[node.field];
    let offset = 0;
    if ('offset' in node) {
      offset = resolveValue(node.offset, parameters, readings);
    }
    return node.negateOffset ? base - offset : base + offset;
  }
  throw new Error(`Unrecognized value node: ${JSON.stringify(node)}`);
}

function compare(a, op, b) {
  switch (op) {
    case 'gt': return a > b;
    case 'gte': return a >= b;
    case 'lt': return a < b;
    case 'lte': return a <= b;
    case 'eq': return a === b;
    case 'ne': return a !== b;
    default: throw new Error(`Unrecognized comparator op: ${op}`);
  }
}

/**
 * Evaluates a single condition node against readings/parameters. Returns boolean.
 */
function evaluateCondition(condition, parameters, readings) {
  if (condition === true) return true;
  if (condition === false) return false;

  if ('all' in condition) {
    return condition.all.every((c) => evaluateCondition(c, parameters, readings));
  }
  if ('any' in condition) {
    return condition.any.some((c) => evaluateCondition(c, parameters, readings));
  }
  if ('not' in condition) {
    return !evaluateCondition(condition.not, parameters, readings);
  }
  if ('cmp' in condition) {
    const { field, op, value } = condition.cmp;
    if (!(field in readings)) {
      throw new Error(`Fault-tree condition references unknown reading field: ${field}`);
    }
    const resolved = resolveValue(value, parameters, readings);
    return compare(readings[field], op, resolved);
  }
  if ('between' in condition) {
    const { field, min, max, inclusive = true } = condition.between;
    if (!(field in readings)) {
      throw new Error(`Fault-tree condition references unknown reading field: ${field}`);
    }
    const v = readings[field];
    const lo = resolveValue(min, parameters, readings);
    const hi = resolveValue(max, parameters, readings);
    return inclusive ? (v >= lo && v <= hi) : (v > lo && v < hi);
  }

  throw new Error(`Unrecognized condition node: ${JSON.stringify(condition)}`);
}

/**
 * Evaluates a fault-tree rule set against a readings object.
 * First matching card wins. Throws if no card matches (the rule set's own
 * terminal `"when": true` catch-all card should make this unreachable in
 * practice — a well-formed rule set always has one).
 *
 * @param {object} ruleSet - parsed rules/fault-trees/*.json content
 * @param {object} readings - flat object, e.g. manifest.diagnostics
 * @returns {{cardId: string, verdict: object}}
 */
function evaluateFaultTree(ruleSet, readings) {
  const { parameters, cards } = ruleSet;
  for (const card of cards) {
    if (evaluateCondition(card.when, parameters, readings)) {
      return { cardId: card.id, verdict: card.verdict };
    }
  }
  throw new Error(
    `No card matched in fault-tree '${ruleSet.id}@${ruleSet.version}' for readings ${JSON.stringify(readings)}. ` +
    `Rule sets should always end in a "when": true catch-all card — this indicates a malformed rule set, not a valid "no verdict" state.`
  );
}

module.exports = { evaluateFaultTree, evaluateCondition, resolveValue };
