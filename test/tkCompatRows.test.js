import test from 'node:test';
import assert from 'node:assert/strict';
import { tkGenerateCompatRows } from '../js/tkCompatRows.js';

const stripAmp = (value) => value.replace(/&amp;/g, '&');

test('generates rows for items that only exist in one survey', () => {
  const partnerA = { Communication: { 'Daily Check-ins': 4 } };
  const partnerB = { Boundaries: { 'Aftercare Talk': 2 } };
  const rows = tkGenerateCompatRows(partnerA, partnerB);
  assert.equal(rows.length, 2);
  const names = rows.map(r => r[0]).sort();
  assert.deepEqual(names, ['Aftercare Talk', 'Daily Check-ins']);
  const rowA = rows.find(r => r[0] === 'Daily Check-ins');
  const rowB = rows.find(r => r[0] === 'Aftercare Talk');
  assert.deepEqual(rowA, ['Daily Check-ins', '4', '', '']);
  assert.deepEqual(rowB, ['Aftercare Talk', '', '', '2']);
});

test('applies label overrides and computes emoji enriched match column', () => {
  const dataA = { Rituals: { 'Corner Time': 5 } };
  const dataB = { Rituals: { 'Corner Time': 5 } };
  const labelMap = { Rituals: { 'Corner Time': 'Corner' } };
  const [row] = tkGenerateCompatRows(dataA, dataB, labelMap);
  assert.equal(row[0], 'Corner');
  assert.equal(stripAmp(row[2]), '100% ⭐');
});

test('flags large mismatches even when one partner maxes the scale', () => {
  const dataA = { Rituals: { 'Scolding': 5 } };
  const dataB = { Rituals: { 'Scolding': 2 } };
  const [row] = tkGenerateCompatRows(dataA, dataB);
  assert.equal(stripAmp(row[2]).endsWith('🟨'), true);
});

test('leaves match column empty when a partner has no data', () => {
  const dataA = { Rituals: { 'Rules': 4 } };
  const dataB = { Rituals: { 'Rules': '' } };
  const [row] = tkGenerateCompatRows(dataA, dataB);
  assert.equal(row[2], '');
});
