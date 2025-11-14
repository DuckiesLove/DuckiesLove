import assert from 'node:assert';
import test from 'node:test';
import {
  TK_FLAG_GREEN,
  TK_FLAG_YELLOW,
  TK_FLAG_RED,
  getFlagSymbol,
  calculateCategoryMatch,
  getMatchColor,
} from '../js/matchFlag.js';

test('returns empty string when row is missing data', () => {
  assert.strictEqual(getFlagSymbol(null), '');
  assert.strictEqual(
    getFlagSymbol({ hasData: false, matchPct: 90, aScore: 5, bScore: 5 }),
    ''
  );
  assert.strictEqual(
    getFlagSymbol({ hasData: true, matchPct: 90, aScore: null, bScore: 5 }),
    ''
  );
});

test('returns red square for severe mismatch', () => {
  const rowLowMatch = { hasData: true, matchPct: 20, aScore: 2, bScore: 2 };
  const rowOpposite = { hasData: true, matchPct: 55, aScore: 0, bScore: 5 };
  assert.strictEqual(getFlagSymbol(rowLowMatch), TK_FLAG_RED);
  assert.strictEqual(getFlagSymbol(rowOpposite), TK_FLAG_RED);
});

test('returns yellow square for caution cases', () => {
  const rowLargeDiff = { hasData: true, matchPct: 50, aScore: 5, bScore: 2 };
  const rowHighLow = { hasData: true, matchPct: 65, aScore: 2, bScore: 5 };
  assert.strictEqual(getFlagSymbol(rowLargeDiff), TK_FLAG_YELLOW);
  assert.strictEqual(getFlagSymbol(rowHighLow), TK_FLAG_YELLOW);
});

test('returns green square for strong alignment', () => {
  const row = { hasData: true, matchPct: 90, aScore: 4, bScore: 4 };
  assert.strictEqual(getFlagSymbol(row), TK_FLAG_GREEN);
});

test('returns empty string when no conditions are met', () => {
  const row = { hasData: true, matchPct: 70, aScore: 3, bScore: 2 };
  assert.strictEqual(getFlagSymbol(row), '');
});

test('calculateCategoryMatch returns 0 for empty data', () => {
  assert.strictEqual(calculateCategoryMatch([]), 0);
});

test('calculateCategoryMatch computes percentage of matching ratings', () => {
  const data = [
    { partnerA: 5, partnerB: 5 },
    { partnerA: 3, partnerB: 3 },
    { partnerA: 2, partnerB: 1 }
  ];
  assert.strictEqual(calculateCategoryMatch(data), 67);
});

test('calculateCategoryMatch ignores missing values', () => {
  const data = [
    { partnerA: null, partnerB: null },
    { partnerA: '-', partnerB: '-' },
    { partnerA: 2, partnerB: 2 },
    { partnerA: 4, partnerB: 0 }
  ];
  assert.strictEqual(calculateCategoryMatch(data), 50);
});

test('getMatchColor returns expected color names', () => {
  assert.strictEqual(getMatchColor(95), 'green');
  assert.strictEqual(getMatchColor(75), 'yellow');
  assert.strictEqual(getMatchColor(59), 'red');
  assert.strictEqual(getMatchColor(null), 'black');
});
