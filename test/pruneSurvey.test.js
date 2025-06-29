import assert from 'node:assert';
import test from 'node:test';
import { pruneSurvey } from '../js/pruneSurvey.js';

test('pruneSurvey removes empty entries', () => {
  const survey = {
    Cat: {
      Giving: [
        { name: 'A', rating: null },
        { name: 'B', rating: 3 }
      ],
      Receiving: [
        { name: 'C', rating: 0 }
      ],
      General: [
        { name: 'D', type: 'text', value: '' },
        { name: 'E', type: 'multi', value: [] },
        { name: 'F', type: 'dropdown', value: 'X' }
      ]
    },
    Empty: {
      Giving: [{ name: 'Z', rating: null }]
    }
  };

  const result = pruneSurvey(survey);
  assert.deepStrictEqual(result, {
    Cat: {
      Giving: [{ name: 'B', rating: 3 }],
      Receiving: [{ name: 'C', rating: 0 }],
      General: [{ name: 'F', type: 'dropdown', value: 'X' }]
    }
  });
});
