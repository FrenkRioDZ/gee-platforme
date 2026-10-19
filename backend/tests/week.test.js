// Week rules (server time, Africa/Algiers): up to the week ending Wed 21/10/2026 a week
// runs Thursday → Wednesday 23:59:59.999; then Thu 22/10 → Tue 27/10, then Wednesday → Tuesday.
process.env.TZ = 'Africa/Algiers';
const test = require('node:test');
const assert = require('node:assert');
const { getWeekDeadline, getWeekStart, getWeekLabel } = require('../utils/scheduler');

const local = (y, m, d, h = 12, min = 0) => new Date(y, m - 1, d, h, min);
const end = (y, m, d) => new Date(y, m - 1, d, 23, 59, 59, 999);

test('old rule: Wednesday deadline, Thursday starts a new week', () => {
  assert.deepStrictEqual(getWeekDeadline(local(2026, 10, 14, 23, 0)), end(2026, 10, 14));
  assert.deepStrictEqual(getWeekDeadline(local(2026, 10, 15, 0, 30)), end(2026, 10, 21));
  assert.deepStrictEqual(getWeekDeadline(local(2026, 10, 21, 23, 0)), end(2026, 10, 21));
});

test('transition week runs Thursday 22/10 → Tuesday 27/10', () => {
  assert.deepStrictEqual(getWeekDeadline(local(2026, 10, 22, 0, 1)), end(2026, 10, 27));
  assert.deepStrictEqual(getWeekDeadline(local(2026, 10, 27, 23, 0)), end(2026, 10, 27));
  assert.deepStrictEqual(getWeekStart(end(2026, 10, 27)), local(2026, 10, 22, 0, 0));
});

test('new rule: Wednesday → Tuesday', () => {
  assert.deepStrictEqual(getWeekDeadline(local(2026, 10, 28, 0, 1)), end(2026, 11, 3));
  assert.deepStrictEqual(getWeekStart(end(2026, 11, 3)), local(2026, 10, 28, 0, 0));
  assert.deepStrictEqual(getWeekStart(end(2026, 10, 14)), local(2026, 10, 8, 0, 0));
});

test('week label continues across the transition without a gap', () => {
  const ods = local(2026, 10, 12); // a Monday — its week ended Wednesday 14/10
  assert.strictEqual(getWeekLabel(ods, local(2026, 10, 12)), 'Semaine 1');
  assert.strictEqual(getWeekLabel(ods, local(2026, 10, 14, 23, 59)), 'Semaine 1');
  assert.strictEqual(getWeekLabel(ods, local(2026, 10, 15, 0, 1)), 'Semaine 2');
  assert.strictEqual(getWeekLabel(ods, local(2026, 10, 22)), 'Semaine 3');
  assert.strictEqual(getWeekLabel(ods, local(2026, 10, 28)), 'Semaine 4');
  assert.strictEqual(getWeekLabel(ods, local(2026, 12, 31)), 'Semaine 13');
});

test('projects starting after the change count Wednesday → Tuesday weeks', () => {
  const ods = local(2026, 11, 4); // a Wednesday
  assert.strictEqual(getWeekLabel(ods, local(2026, 11, 10, 23, 0)), 'Semaine 1');
  assert.strictEqual(getWeekLabel(ods, local(2026, 11, 11)), 'Semaine 2');
});

test('dates before the ODS never give a week below 1', () => {
  assert.strictEqual(getWeekLabel(local(2026, 10, 12), local(2026, 9, 1)), 'Semaine 1');
});
