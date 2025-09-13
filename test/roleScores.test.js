import assert from 'node:assert';
import test from 'node:test';
import { calculateRoleScores } from '../js/roleScores.js';

test('normalizes scores based on highest role', () => {
  const survey = [
    { question: 'i enjoy degrading', value: 5 },
    { question: 'i enjoy being degraded', value: 4 }
  ];
  const results = calculateRoleScores(survey);
  const get = name => results.find(r => r.name === name).percent;
  assert.strictEqual(get('Degrader'), 100);
  assert.strictEqual(get('degradee'), 71);
});
