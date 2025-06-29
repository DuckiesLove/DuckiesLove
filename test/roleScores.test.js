import assert from 'node:assert';
import test from 'node:test';
import { calculateRoleScores } from '../js/roleScores.js';

const sampleSurvey = {
  Category: {
    Giving: [
      {
        name: 'Edge',
        rating: 5,
        roles: [
          { name: 'Sadist', weight: 1 },
          { name: 'Masochist', weight: 2 }
        ]
      },
      {
        name: 'Ignore',
        rating: null,
        roles: [{ name: 'Dominant', weight: 1 }]
      }
    ],
    Receiving: [],
    General: []
  }
};

test('calculates percentages based on rating and weight', () => {
  const result = calculateRoleScores(sampleSurvey);
  const mas = result.find(r => r.name === 'masochist');
  const sad = result.find(r => r.name === 'sadist');
  assert.strictEqual(mas.percent, 100);
  assert.strictEqual(sad.percent, 100);
});

test('handles partial scores and missing weights', () => {
  const survey = {
    Cat: {
      Giving: [
        { name: 'X', rating: 3, roles: [{ name: 'dominant' }] }
      ],
      Receiving: [],
      General: []
    }
  };
  const result = calculateRoleScores(survey);
  const dom = result.find(r => r.name === 'dominant');
  assert.strictEqual(dom.percent, 60);
});
