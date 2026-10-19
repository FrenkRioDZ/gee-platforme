// Week rules: a week runs Thursday → Wednesday 23:59:59.999 (server time, Africa/Algiers)
process.env.TZ = 'Africa/Algiers';
const test = require('node:test');
const assert = require('node:assert');
const { getWeekDeadline, getWeekLabel } = require('../utils/scheduler');

const local = (y, m, d, h = 12, min = 0) => new Date(y, m - 1, d, h, min);

test('Wednesday before midnight belongs to that same Wednesday deadline', () => {
  assert.deepStrictEqual(getWeekDeadline(local(2026, 10, 14, 23, 0)), new Date(2026, 9, 14, 23, 59, 59, 999));
});

test('Thursday starts a new week ending the next Wednesday', () => {
  assert.deepStrictEqual(getWeekDeadline(local(2026, 10, 15, 0, 30)), new Date(2026, 9, 21, 23, 59, 59, 999));
});

test('week label counts Thursday-to-Wednesday cycles from the ODS date', () => {
  const ods = local(2026, 10, 12); // a Monday — its cycle started Thursday 08/10
  assert.strictEqual(getWeekLabel(ods, local(2026, 10, 12)), 'Semaine 1');
  assert.strictEqual(getWeekLabel(ods, local(2026, 10, 14, 23, 59)), 'Semaine 1');
  assert.strictEqual(getWeekLabel(ods, local(2026, 10, 15, 0, 1)), 'Semaine 2');
  assert.strictEqual(getWeekLabel(ods, local(2026, 12, 31)), 'Semaine 13');
});

test('dates before the ODS never give a week below 1', () => {
  assert.strictEqual(getWeekLabel(local(2026, 10, 12), local(2026, 9, 1)), 'Semaine 1');
});
