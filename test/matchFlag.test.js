import assert from 'node:assert';
import test from 'node:test';
import { getFlagEmoji, calculateCategoryMatch, getMatchColor } from '../js/matchFlag.js';

test('returns star for 90 percent and above', () => {
  assert.strictEqual(getFlagEmoji(100), '⭐');
  assert.strictEqual(getFlagEmoji(90), '⭐');
});

test('returns red flag for values below 30', () => {
  assert.strictEqual(getFlagEmoji(25), '🚩');
  assert.strictEqual(getFlagEmoji(0), '🚩');
});

test('returns empty string for other values', () => {
  assert.strictEqual(getFlagEmoji(75), '');
  assert.strictEqual(getFlagEmoji(60), '');
  assert.strictEqual(getFlagEmoji(80), '');
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
