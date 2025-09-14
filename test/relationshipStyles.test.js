import assert from 'node:assert';
import test from 'node:test';
import { calculateRoleScores } from '../js/calculateRoleScores.js';

test('relationship style questions map to roles', () => {
  const survey = [
    { question: 'prefer one partner only', value: 5 },
    { question: 'partners & metamours are close friends', value: 4 },
    { question: 'keep metamours separate', value: 3 }
  ];
  const results = calculateRoleScores(survey);
  const get = name => results.find(r => r.name === name)?.percent;
  assert.strictEqual(get('Monogamy'), 100);
  assert.strictEqual(get('Kitchen Table Poly'), 71);
  assert.strictEqual(get('Parallel Poly'), 43);
});
