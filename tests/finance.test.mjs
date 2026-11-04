import test from 'node:test';
import assert from 'node:assert/strict';
import { budgetStatus, computeSettlement, detectUnusual, forecastMonth, newThresholds, oneOffTotal, safeDailySpend } from '../lib/finance.js';

test('budget thresholds fire once each, and 100 only when exceeded', () => {
  assert.deepEqual(newThresholds(76, []), [50, 75]);
  assert.deepEqual(newThresholds(76, [50, 75]), []);
  assert.deepEqual(newThresholds(100, [50, 75, 90]), []);
  assert.deepEqual(newThresholds(100.5, [50, 75, 90]), [100]);
});

test('budget status reports allowance and overspending', () => {
  const now = new Date('2026-11-16T00:00:00Z');
  const s = budgetStatus({ amount: 3000, spent: 1500, startDate: '2026-11-01T00:00:00Z', endDate: '2026-12-01T00:00:00Z', now });
  assert.equal(s.remaining, 1500);
  assert.equal(s.daysLeft, 15);
  assert.equal(s.dailyAllowance, 100);
  assert.equal(s.plannedToDate, 1500);
  assert.equal(budgetStatus({ amount: 100, spent: 150, startDate: '2026-11-01', endDate: '2026-12-01', now }).status, 'over');
});

test('forecast projects from pace and flags early months as unreliable', () => {
  assert.deepEqual(forecastMonth({ spentSoFar: 1000, dayOfMonth: 10, daysInMonth: 30 }), { projected: 3000, dailyPace: 100, reliable: true });
  assert.equal(forecastMonth({ spentSoFar: 100, dayOfMonth: 2, daysInMonth: 30 }).reliable, false);
});

test('safe spend never goes negative', () => {
  assert.equal(safeDailySpend({ available: -500, daysLeft: 10 }), 0);
  assert.equal(safeDailySpend({ available: 1000, daysLeft: 10 }), 100);
});

test('unusual spending flags a real jump and ignores normal months', () => {
  const history = [{ Food: 1000 }, { Food: 1100 }, { Food: 900 }];
  assert.equal(detectUnusual({ current: { Food: 1050 }, history, monthProgress: 1 }).length, 0);
  assert.equal(detectUnusual({ current: { Food: 2000 }, history, monthProgress: 1 })[0].category, 'Food');
});

test('settlement finds minimal transfers and sums to zero', () => {
  const r = computeSettlement({ members: ['a', 'b', 'c'], paid: { a: 300, b: 0, c: 0 } });
  assert.equal(r.share, 100);
  assert.deepEqual(r.transfers.map((t) => [t.from, t.to, t.amount]).sort(), [['b', 'a', 100], ['c', 'a', 100]]);
  assert.ok(Math.abs(r.balances.reduce((s, b) => s + b.balance, 0)) < 0.01);
});

test('recorded settlements reduce what is still owed', () => {
  const r = computeSettlement({ members: ['a', 'b'], paid: { a: 200 }, settlements: [{ from: 'b', to: 'a', amount: 100 }] });
  assert.equal(r.transfers.length, 0);
});

test('rent paid early does not inflate the forecast', () => {
  const amounts = [45000, 500, 800, 1200, 600];
  assert.equal(oneOffTotal(amounts), 45000);
  const f = forecastMonth({ spentSoFar: 48100, dayOfMonth: 5, daysInMonth: 30, oneOff: 45000 });
  assert.equal(f.dailyPace, 620);
  assert.equal(f.projected, 63600);
});

test('a monthly bill paid early is not unusual, but a doubled one is', () => {
  const history = [{ Rent: 45000 }, { Rent: 45000 }];
  const counts = [{ Rent: 1 }, { Rent: 1 }];
  assert.equal(detectUnusual({ current: { Rent: 45000 }, history, counts, monthProgress: 0.15 }).length, 0);
  assert.equal(detectUnusual({ current: { Rent: 90000 }, history, counts, monthProgress: 0.15 }).length, 1);
});
