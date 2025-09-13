import assert from 'node:assert';
import test from 'node:test';
import { calculateRoleScores } from '../js/roleScores.js';

test('normalizes scores based on highest role', () => {
  const survey = [
    { question: 'Do you enjoy receiving pain?', value: 2 },
    { question: 'Do you enjoy inflicting pain?', value: 4 }
  ];
  const results = calculateRoleScores(survey);
  const get = name => results.find(r => r.name === name).percent;
  assert.strictEqual(get('Masochist'), 50);
  assert.strictEqual(get('Sadist'), 100);
});
