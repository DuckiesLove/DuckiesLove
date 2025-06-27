const { calculateCompatibility } = require('../js/compatibility');
const assert = require('node:assert');
const test = require('node:test');

test('opposite ratings trigger red flag and zero score', () => {
  const surveyA = { Cat: { Giving: [{ name: 'A', rating: 5 }], Receiving: [], General: [] } };
  const surveyB = { Cat: { Giving: [], Receiving: [{ name: 'A', rating: 0 }], General: [] } };
  const result = calculateCompatibility(surveyA, surveyB);
  assert.strictEqual(result.compatibilityScore, 0);
  assert.ok(result.redFlags.includes('A'));
});

test('rating difference of two yields 60 score', () => {
  const surveyA = { Cat: { Giving: [{ name: 'A', rating: 5 }], Receiving: [], General: [] } };
  const surveyB = { Cat: { Giving: [], Receiving: [{ name: 'A', rating: 3 }], General: [] } };
  const result = calculateCompatibility(surveyA, surveyB);
  assert.strictEqual(result.compatibilityScore, 60);
  assert.deepStrictEqual(result.redFlags, []);
});

test('similar ratings in same role produce similarity score', () => {
  const surveyA = { Cat: { Giving: [{ name: 'X', rating: 2 }], Receiving: [], General: [] } };
  const surveyB = { Cat: { Giving: [{ name: 'X', rating: 2 }], Receiving: [], General: [] } };
  const result = calculateCompatibility(surveyA, surveyB);
  assert.strictEqual(result.similarityScore, 100);
});
