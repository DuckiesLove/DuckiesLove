import assert from 'node:assert';
import test from 'node:test';
import { getMatchFlag, calculateCategoryMatch, getProgressBarColor } from '../js/matchFlag.js';

test('returns star for 100 percent', () => {
  assert.strictEqual(getMatchFlag(100), '⭐');
});

test('returns green flag for values between 85 and 99', () => {
  assert.strictEqual(getMatchFlag(90), '🟩');
  assert.strictEqual(getMatchFlag(85), '🟩');
});

test('returns red flag for values 40 or below', () => {
  assert.strictEqual(getMatchFlag(40), '🚩');
  assert.strictEqual(getMatchFlag(0), '🚩');
});

test('returns empty string for other values', () => {
  assert.strictEqual(getMatchFlag(70), '');
  assert.strictEqual(getMatchFlag(41), '');
});

test('calculateCategoryMatch returns 0 for empty data', () => {
  assert.strictEqual(calculateCategoryMatch([], []), 0);
});

test('calculateCategoryMatch computes percentage of matching ratings', () => {
  const a = [5, 3, 2];
  const b = [5, 3, 1];
  assert.strictEqual(calculateCategoryMatch(a, b), 67);
});

test('calculateCategoryMatch ignores missing values', () => {
  const a = [null, '-', 2, 4];
  const b = [null, '-', 2, 0];
  assert.strictEqual(calculateCategoryMatch(a, b), 50);
});

test('getProgressBarColor returns expected hex codes', () => {
  assert.strictEqual(getProgressBarColor(85), '#00cc66');
  assert.strictEqual(getProgressBarColor(70), '#ffcc00');
  assert.strictEqual(getProgressBarColor(50), '#ff4444');
});
