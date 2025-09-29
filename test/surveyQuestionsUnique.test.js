import fs from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';

const survey = JSON.parse(
  fs.readFileSync(new URL('../survey.json', import.meta.url), 'utf8')
);

const questions = survey.sections.flatMap((section) => section.questions);

const findDuplicates = (values) => {
  const seen = new Set();
  const duplicates = new Set();

  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value);
    }
    seen.add(value);
  }

  return [...duplicates];
};

test('survey question ids are unique', () => {
  const duplicates = findDuplicates(questions.map((question) => question.id));
  assert.deepStrictEqual(
    duplicates,
    [],
    `Duplicate question id(s) found: ${duplicates.join(', ')}`
  );
});

test('survey question text is unique', () => {
  const duplicates = findDuplicates(questions.map((question) => question.q.trim()));
  assert.deepStrictEqual(
    duplicates,
    [],
    `Duplicate question text found: ${duplicates.join(', ')}`
  );
});
