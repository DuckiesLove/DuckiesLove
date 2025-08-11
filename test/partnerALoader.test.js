import test from 'node:test';
import assert from 'node:assert';
import { normalizeSurvey, surveyToLookup } from '../js/partnerALoader.js';

test('normalize flat key-value object', () => {
  const survey = normalizeSurvey({ Bondage: 4 });
  const lookup = surveyToLookup(survey);
  assert.deepStrictEqual(lookup, { bondage: 4 });
});

test('normalize items array', () => {
  const survey = normalizeSurvey({ items: [{ key: 'Bondage', rating: 5 }] });
  const lookup = surveyToLookup(survey);
  assert.deepStrictEqual(lookup, { bondage: 5 });
});
