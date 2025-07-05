import { calculateCompatibility } from '../js/compatibility.js';
import assert from 'node:assert';
import test from 'node:test';

test('opposite ratings trigger red flag and zero score', () => {
  const surveyA = { Cat: { Giving: [{ name: 'A', rating: 5 }], Receiving: [], General: [] } };
  const surveyB = { Cat: { Giving: [], Receiving: [{ name: 'A', rating: 0 }], General: [] } };
  const result = calculateCompatibility(surveyA, surveyB);
  assert.strictEqual(result.compatibilityScore, 0);
  assert.ok(result.redFlags.includes('A'));
});

test('medium ratings yield 50 score', () => {
  const surveyA = { Cat: { Giving: [{ name: 'A', rating: 5 }], Receiving: [], General: [] } };
  const surveyB = { Cat: { Giving: [], Receiving: [{ name: 'A', rating: 3 }], General: [] } };
  const result = calculateCompatibility(surveyA, surveyB);
  assert.strictEqual(result.compatibilityScore, 50);
  assert.deepStrictEqual(result.redFlags, []);
});

test('strong match yields 100 score', () => {
  const surveyA = { Cat: { Giving: [{ name: 'B', rating: 4 }], Receiving: [], General: [] } };
  const surveyB = { Cat: { Giving: [], Receiving: [{ name: 'B', rating: 5 }], General: [] } };
  const result = calculateCompatibility(surveyA, surveyB);
  assert.strictEqual(result.compatibilityScore, 100);
});

test('similar ratings in same role produce similarity score', () => {
  const surveyA = { Cat: { Giving: [{ name: 'X', rating: 2 }], Receiving: [], General: [] } };
  const surveyB = { Cat: { Giving: [{ name: 'X', rating: 2 }], Receiving: [], General: [] } };
  const result = calculateCompatibility(surveyA, surveyB);
  assert.strictEqual(result.similarityScore, 100);
});

test('returns breakdown per category', () => {
  const surveyA = { Cat: { Giving: [{ name: 'A', rating: 5 }], Receiving: [], General: [] } };
  const surveyB = { Cat: { Giving: [], Receiving: [{ name: 'A', rating: 5 }], General: [] } };
  const result = calculateCompatibility(surveyA, surveyB);
  assert.strictEqual(result.categoryBreakdown.Cat, 100);
});

test('kink breakdown includes match info', () => {
  const surveyA = { Cat: { Giving: [{ name: 'Z', rating: 4 }], Receiving: [], General: [] } };
  const surveyB = { Cat: { Giving: [], Receiving: [{ name: 'Z', rating: 4 }], General: [] } };
  const result = calculateCompatibility(surveyA, surveyB);
  assert.strictEqual(result.kinkBreakdown.Cat[0].indicator, '✅');
  assert.strictEqual(result.kinkBreakdown.Cat[0].you.giving, 4);
  assert.strictEqual(result.kinkBreakdown.Cat[0].partner.receiving, 4);
});
