import assert from 'node:assert';
import test from 'node:test';
import { drawMatchBar, renderCategorySection } from '../js/compatibilityReportHelpers.js';

function createDocMock() {
  const calls = [];
  const record = (name) => (...args) => {
    calls.push([name, args]);
  };
  return {
    calls,
    setFillColor: record('setFillColor'),
    rect: record('rect'),
    setTextColor: record('setTextColor'),
    setFontSize: record('setFontSize'),
    text: record('text')
  };
}

test('drawMatchBar fills width proportional to percentage', () => {
  const doc = createDocMock();
  drawMatchBar(doc, 10, 10, 100, 8, 50);
  const rectCalls = doc.calls.filter(c => c[0] === 'rect');
  assert.deepStrictEqual(rectCalls[0], ['rect', [10, 10, 100, 8, 'F']]);
  assert.deepStrictEqual(rectCalls[1], ['rect', [10, 10, 50, 8, 'F']]);
  const textCall = doc.calls.find(c => c[0] === 'text');
  assert.deepStrictEqual(textCall, ['text', ['50%', 60, 16, { align: 'center' }]]);
});

test('renderCategorySection renders each item and returns final y', () => {
  const doc = createDocMock();
  const items = [
    { label: 'First', partnerA: 1, partnerB: 1, match: 100 },
    { label: 'Second', partnerA: 2, partnerB: 3, match: 75 }
  ];
  const endY = renderCategorySection(doc, 5, 20, 'MyCat', items);
  assert.strictEqual(endY, 20 + 10 + 12 * items.length);
  const texts = doc.calls.filter(c => c[0] === 'text').map(c => c[1][0]);
  assert(texts.includes('MyCat'));
  assert(texts.includes('First'));
  assert(texts.includes('Second'));
});
