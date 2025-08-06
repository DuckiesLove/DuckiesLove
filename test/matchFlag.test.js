import assert from 'node:assert';
import test from 'node:test';
import { getFlagEmoji, calculateCategoryMatch, getMatchColor } from '../js/matchFlag.js';

test('returns star for 90 percent and above', () => {
  assert.strictEqual(getFlagEmoji(100), '⭐');
  assert.strictEqual(getFlagEmoji(90), '⭐');
});

test('returns green square for values 80-89', () => {
  assert.strictEqual(getFlagEmoji(85), '🟩');
});

test('returns red flag for values 40 or below', () => {
  assert.strictEqual(getFlagEmoji(40), '🚩');
  assert.strictEqual(getFlagEmoji(0), '🚩');
});

test('returns yellow flag when one partner loves it and the other does not', () => {
  assert.strictEqual(getFlagEmoji(60, 5, 3), '🟨');
  assert.strictEqual(getFlagEmoji(60, 3, 5), '🟨');
});

test('returns empty string for other values', () => {
  assert.strictEqual(getFlagEmoji(75), '');
  assert.strictEqual(getFlagEmoji(41), '');
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
  assert.strictEqual(getMatchColor(85), 'green');
  assert.strictEqual(getMatchColor(60), 'yellow');
  assert.strictEqual(getMatchColor(59), 'red');
  assert.strictEqual(getMatchColor(null), 'black');
});
