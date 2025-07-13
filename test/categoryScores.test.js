import assert from 'node:assert';
import test from 'node:test';
import { calculateCategoryScores } from '../js/categoryScores.js';

test('calculates percentages for categories', () => {
  const survey = {
    Cat1: {
      Giving: [{ name: 'A', rating: 5 }],
      Receiving: [{ name: 'B', rating: 3 }],
      General: []
    },
    Cat2: {
      Giving: [{ name: 'C', rating: 0 }],
      Receiving: [],
      General: []
    }
  };
  const result = calculateCategoryScores(survey);
  const cat1 = result.find(r => r.name === 'Cat1').percent;
  const cat2 = result.find(r => r.name === 'Cat2').percent;
  assert.strictEqual(cat1, 80); // (5+3)/(2*5)=0.8
  assert.strictEqual(cat2, 0);
});
