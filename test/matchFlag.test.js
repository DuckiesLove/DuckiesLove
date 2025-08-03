import assert from 'node:assert';
import test from 'node:test';
import { getMatchFlag, calculateCategoryMatch } from '../js/matchFlag.js';

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
