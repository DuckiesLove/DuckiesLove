import assert from 'node:assert';
import test from 'node:test';
import { calculateRoleScores } from '../js/calculateRoleScores.js';

test('calculateRoleScores maps answers to roles', () => {
  const survey = [
    { question: 'Do you enjoy being restrained?', value: 5 },
    { question: 'Do you like restraining others?', value: 3 },
    { question: 'Do you enjoy acting bratty?', value: 4 }
  ];
  const results = calculateRoleScores(survey);
  const get = name => results.find(r => r.name === name).percent;
  assert.strictEqual(get('Bondage Bottom'), 100);
  assert.strictEqual(get('Rope Bottom'), 100);
  assert.strictEqual(get('Bondage Top'), 60);
  assert.strictEqual(get('Rope Top'), 60);
  assert.strictEqual(get('Brat'), 80);
});
