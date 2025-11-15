import assert from 'node:assert';
import test from 'node:test';
import {
  TK_FLAG_GREEN,
  TK_FLAG_YELLOW,
  TK_FLAG_RED,
  getFlagColor,
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

test('getFlagColor returns expected palette', () => {
  assert.strictEqual(getFlagColor(95, 5, 5), 'green');
  assert.strictEqual(getFlagColor(20, 2, 2), 'red');
  assert.strictEqual(getFlagColor(65, 5, 3), 'yellow');
  assert.strictEqual(getFlagColor(55, 0, 5), 'yellow');
  assert.strictEqual(getFlagColor(70, 3, 2), '');
});

test('getFlagSymbol maps colors to emoji squares', () => {
  const redRow = { hasData: true, matchPct: 15, aScore: 2, bScore: 2 };
  const yellowRow = { hasData: true, matchPct: 65, aScore: 5, bScore: 3 };
  const greenRow = { hasData: true, matchPct: 95, aScore: 4, bScore: 4 };
  const neutralRow = { hasData: true, matchPct: 70, aScore: 3, bScore: 2 };
  assert.strictEqual(getFlagSymbol(redRow), TK_FLAG_RED);
  assert.strictEqual(getFlagSymbol(yellowRow), TK_FLAG_YELLOW);
  assert.strictEqual(getFlagSymbol(greenRow), TK_FLAG_GREEN);
  assert.strictEqual(getFlagSymbol(neutralRow), '');
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
