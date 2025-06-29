import { calculateRoleScores } from '../js/calculateRoleScores.js';
import assert from 'node:assert';
import test from 'node:test';

test('calculateRoleScores aggregates role percentages', () => {
  const survey = {
    all: [
      { rating: 5, roles: [{ name: 'dominant' }] },
      { rating: 3, roles: [{ name: 'dominant' }, { name: 'sadist', weight: 2 }] },
      { rating: null, roles: [{ name: 'switch' }] }
    ]
  };
  const results = calculateRoleScores(survey, 5);
  const dominant = results.find(r => r.name === 'dominant').percent;
  const sadist = results.find(r => r.name === 'sadist').percent;
  assert.strictEqual(dominant, 80);
  assert.strictEqual(sadist, 60);
});
