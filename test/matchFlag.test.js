import assert from 'node:assert';
import test from 'node:test';
import { getFlagEmoji, calculateCategoryMatch, getMatchColor } from '../js/matchFlag.js';

test('returns star for 90 percent and above', () => {
  assert.strictEqual(getFlagEmoji(100), '⭐');
  assert.strictEqual(getFlagEmoji(90), '⭐');
});

test('returns red flag for values 50 or below', () => {
  assert.strictEqual(getFlagEmoji(50), '🚩');
  assert.strictEqual(getFlagEmoji(0), '🚩');
});

test('returns empty string for other values', () => {
  assert.strictEqual(getFlagEmoji(75), '');
  assert.strictEqual(getFlagEmoji(51), '');
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

test('getMatchColor returns expected hex codes', () => {
  assert.strictEqual(getMatchColor(85), '#00cc66');
  assert.strictEqual(getMatchColor(70), '#ffcc00');
  assert.strictEqual(getMatchColor(50), '#ff4444');
  assert.strictEqual(getMatchColor(null), '#000000');
});
