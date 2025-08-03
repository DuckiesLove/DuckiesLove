import assert from 'node:assert';
import test from 'node:test';
import { getMatchFlag } from '../js/matchFlag.js';

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
