import assert from 'node:assert';
import test from 'node:test';
import { calculateRoleScores } from '../js/calculateRoleScores.js';

test('calculateRoleScores maps answers to roles', () => {
  const survey = [
    { question: 'i enjoy rope', value: 5 },
    { question: 'i enjoy being degraded', value: 4 },
    { question: 'i am a brat', value: 5 }
  ];
  const results = calculateRoleScores(survey);
  const get = name => results.find(r => r.name === name).percent;
  assert.strictEqual(get('Rope Bottom'), 100);
  assert.strictEqual(get('Rope Top'), 100);
  assert.strictEqual(get('Brat'), 100);
  assert.strictEqual(get('degradee'), 71);
});
