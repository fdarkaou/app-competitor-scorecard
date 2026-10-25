import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { toRows, sortRows, describe, change, toMarkdown, toCsv, compact, toChat } from '../scorecard.js';

const resp = JSON.parse(readFileSync(new URL('../examples/compare.json', import.meta.url)));

test('describe handles range, below floor and unknown', () => {
  assert.equal(describe({ kind: 'range', range: { low: 18000, mid: 36000, high: 75000 } }), '18k–75k (mid 36k)');
  assert.equal(describe({ kind: 'below_floor', ceiling: 5000 }, true), 'under $5k');
  assert.equal(describe(null), 'unknown');
});

test('month-over-month change uses mids, only when both months are ranges', () => {
  const [me, big, small] = toRows(resp);
  assert.equal(Math.round(me.installsChange * 100), 20);
  assert.equal(Math.round(big.installsChange * 100), -9);
  assert.equal(big.revenueChange, null);
  assert.equal(small.installsChange, null);
  assert.equal(change({ kind: 'below_floor', ceiling: 5000, previous: { kind: 'range', range: { mid: 1 } } }), null);
});

test('subject stays first, unknown estimates sort last', () => {
  const rows = sortRows(toRows(resp), 'installs');
  assert.deepEqual(rows.map((r) => r.storeId), ['1000000001', '1000000002', '1000000003', '1000000004']);
  const byRev = sortRows(toRows(resp), 'revenue');
  assert.equal(byRev[0].isSubject, true);
  assert.equal(byRev.at(-1).storeId, '1000000004');
});

test('markdown and csv outputs', () => {
  const md = toMarkdown(resp);
  assert.match(md, /\*\*Example Meal Planner\*\* \(you\)/);
  assert.match(md, /Not in the catalogue: 1000000005/);
  const csv = toCsv(resp).split('\n');
  assert.equal(csv.length, 5);
  assert.match(csv[3], /below_floor,,,5000/);
  assert.match(toChat(resp), /you: Example Meal Planner/);
  assert.equal(compact(1300000), '1.3M');
});
