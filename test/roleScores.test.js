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
  const expected = [
    { name: 'Masochist', percent: 100 },
    { name: 'Sadist', percent: 100 }
  ];
  // result order isn't guaranteed when percentages tie
  assert.deepStrictEqual(
    result.sort((a, b) => a.name.localeCompare(b.name)),
    expected.sort((a, b) => a.name.localeCompare(b.name))
  );
});

test('handles partial scores and missing weights', () => {
  const survey = {
    Cat: {
      Giving: [
        { name: 'X', rating: 3, roles: [{ name: 'Dom' }] }
      ],
      Receiving: [],
      General: []
    }
  };
  const result = calculateRoleScores(survey);
  assert.deepStrictEqual(result, [
    { name: 'Dom', percent: 60 }
  ]);
});
