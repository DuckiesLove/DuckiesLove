import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const extractParser = async () => {
  const html = await readFile(new URL('../compatibility.html', import.meta.url), 'utf8');
  const match = html.match(/function ksvParseSurveyJsonText[\s\S]*?return \{ ok:true, cells, survey: \{ answers, answersByKey \} \};\n\}/);
  assert(match, 'ksvParseSurveyJsonText definition not found');
  // eslint-disable-next-line no-new-func
  return new Function(`${match[0]}; return ksvParseSurveyJsonText;`)();
};

test('ksvParseSurveyJsonText accepts answersByKey payloads', async () => {
  const parse = await extractParser();
  const answersByKey = {};
  for (let i = 35; i >= 1; i -= 1) {
    answersByKey[String(i)] = i % 6; // intentionally reverse order to exercise sorting
  }
  const json = JSON.stringify({ answersByKey });
  const result = parse(json, 'A');
  assert.equal(result.ok, true, result.reason || 'expected ok');
  assert.strictEqual(result.cells.length, 35);
  const expected = Array.from({ length: 35 }, (_, idx) => (idx + 1) % 6);
  assert.deepEqual(result.cells, expected);
  assert.deepEqual(
    result.survey?.answers,
    Object.fromEntries(expected.map((val, idx) => [String(idx + 1), val])),
    'normalized survey answers should preserve keyed ratings',
  );
  assert.deepEqual(
    result.survey?.answersByKey,
    Object.fromEntries(expected.map((val, idx) => [String(idx + 1), val])),
    'answersByKey mirror should be generated',
  );
});
