import test from 'node:test';
import assert from 'node:assert';
import { normalizeSurvey, validateNormalized, toNumberish } from '../js/normalizeSurvey.js';

test('toNumberish parses percentages and fractions', () => {
  assert.strictEqual(toNumberish('80%'), 4); // 80% -> 4 (since 100%/20)
  assert.strictEqual(toNumberish('3/5'), 3);
  assert.strictEqual(toNumberish('2'), 2);
  assert.strictEqual(toNumberish('bad'), null);
});

test('normalizeSurvey collects items and warnings', () => {
  const input = [
    { id: 'Bondage', rating: '5' },
    { id: 'Service', score: 'not-a-number' }
  ];
  const { items, warnings } = normalizeSurvey(input);
  assert.deepStrictEqual(items, [
    { id: 'Bondage', label: 'Bondage', score: 5 },
    { id: 'Service', label: 'Service', score: null }
  ]);
  assert.strictEqual(warnings.length, 1);
});

test('validateNormalized detects missing scores', () => {
  const normalized = normalizeSurvey([{ id: 'Bondage', rating: 'N/A' }]);
  const errors = validateNormalized(normalized);
  assert.ok(errors.length > 0);
});

test('validateNormalized passes with numeric scores', () => {
  const normalized = normalizeSurvey([{ id: 'Bondage', rating: 4 }]);
  const errors = validateNormalized(normalized);
  assert.deepStrictEqual(errors, []);
});
