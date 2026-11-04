import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDate, parseReceipt } from '../lib/scan/receiptParser.js';
import { matchCategory, parseQuestion } from '../lib/assistant/rules.js';
import { sniffMime } from '../lib/sniff.js';

const RECEIPT = `AL-FATAH STORE
Main Boulevard Lahore
Date: 12/10/2026 18:42
Item Qty Price
Milk 2 x 200 400
Bread 1 150.00
Eggs 12 360
Rice 2 kg 600
Sub Total 1,510
GST 17% 257
Grand Total Rs. 1,767
Cash 2,000
Change 233
Thank you`;

test('reads items, tax, total, store and date from a receipt', () => {
  const r = parseReceipt(RECEIPT);
  assert.equal(r.store, 'AL-FATAH STORE');
  assert.equal(r.total, 1767);
  assert.equal(r.tax, 257);
  assert.equal(r.date.toISOString().slice(0, 10), '2026-10-12');
  assert.deepEqual(r.items.map((i) => [i.name, i.quantity, i.price]), [
    ['Milk', '2', 400],
    ['Bread', '1', 150],
    ['Eggs', '12', 360],
    ['Rice', '2 kg', 600],
  ]);
});

test('computes a total when the receipt has none', () => {
  assert.equal(parseReceipt('Tea 50\nSugar 120').total, 170);
});

test('reads common date styles, day first', () => {
  assert.equal(parseDate('03-02-2026').toISOString().slice(0, 10), '2026-02-03');
  assert.equal(parseDate('2026-11-04').toISOString().slice(0, 10), '2026-11-04');
  assert.equal(parseDate('4 Nov 2026').toISOString().slice(0, 10), '2026-11-04');
  assert.equal(parseDate('nothing here'), null);
});

const CATS = ['Food & Groceries', 'Transportation', 'Rent'];

test('understands the example questions', () => {
  assert.equal(parseQuestion('How much did I spend this month?', CATS).intent, 'spent');
  assert.deepEqual(parseQuestion('How much did I spend on food last week?', CATS), { intent: 'spent', period: 'lastWeek', category: 'Food & Groceries' });
  assert.equal(parseQuestion('Where does most of my money go?', CATS).intent, 'categories');
  assert.equal(parseQuestion('Compare my spending this month with last month', CATS).intent, 'compare');
  assert.equal(parseQuestion('How much can I safely spend today based on my remaining budget?', CATS).intent, 'safe');
  assert.equal(parseQuestion('Which category should I reduce?', CATS).intent, 'reduce');
  assert.equal(parseQuestion('Show my biggest expenses', CATS).intent, 'biggest');
});

test('turns an add command into a proposal, never a question', () => {
  const q = parseQuestion('spent 500 on groceries', CATS);
  assert.equal(q.intent, 'add');
  assert.equal(q.amount, 500);
  assert.equal(q.category, 'Food & Groceries');
});

test('category matching uses aliases', () => {
  assert.equal(matchCategory('petrol this week', CATS), 'Transportation');
});

test('file checks use content, not the name', () => {
  assert.equal(sniffMime(Buffer.from('89504e470d0a1a0a0000000000', 'hex')), 'image/png');
  assert.equal(sniffMime(Buffer.from('%PDF-1.7 aaaaaaaa')), 'application/pdf');
  assert.equal(sniffMime(Buffer.from('<svg onload=alert(1)></svg>')), null);
  assert.equal(sniffMime(Buffer.from('MZ executable data here')), null);
});
