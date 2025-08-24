import assert from 'node:assert';
import test from 'node:test';
import {
  drawMatchBar,
  renderCategorySection,
  normalizeScore,
  getMatchPercentage,
  buildLayout
} from '../js/compatibilityReportHelpers.js';

function createDocMock() {
  const calls = [];
  const record = (name) => (...args) => {
    calls.push([name, args]);
  };
  return {
    calls,
    internal: { pageSize: { getWidth: () => 300 } },
    setFillColor: record('setFillColor'),
    rect: record('rect'),
    setTextColor: record('setTextColor'),
    setFontSize: record('setFontSize'),
    text: record('text')
  };
}

test('drawMatchBar renders white bar with colored text and resets color', () => {
  const doc = createDocMock();
  drawMatchBar(doc, 10, 10, 100, 8, 50);
  doc.text('after', 0, 0); // simulate subsequent drawing

  const rectCalls = doc.calls.filter(c => c[0] === 'rect');
  assert.deepStrictEqual(rectCalls[0], ['rect', [10, 10, 100, 8, 'F']]);
// ✅ Final merged version
const fillColorCall = doc.calls.find(c => c[0] === 'setFillColor');
assert.deepStrictEqual(fillColorCall, ['setFillColor', [255, 255, 255]]);

const colorCalls = doc.calls.filter(c => c[0] === 'setTextColor');
assert.deepStrictEqual(colorCalls[0], ['setTextColor', [255, 0, 0]]);
assert.deepStrictEqual(colorCalls[colorCalls.length - 1], ['setTextColor', ['black']]);

  const textCall = doc.calls.find(c => c[0] === 'text' && c[1][0] === '50%');
  assert.ok(textCall, 'percentage label should be rendered');
});

test('flag and partner B columns render in black after drawMatchBar', () => {
  const doc = createDocMock();
  const items = [{ label: 'Test', partnerA: 4, partnerB: 0 }]; // results in a 🚩 flag
  const margin = 5;
  const usableWidth = doc.internal.pageSize.getWidth() - margin * 2;
  const layout = buildLayout(margin, usableWidth);
  renderCategorySection(doc, 'Cat', items, layout, 20);

  const flagIndex = doc.calls.findIndex(c => c[0] === 'text' && c[1][0] === '🚩');
  const lastColorBeforeFlag = doc.calls.slice(0, flagIndex).filter(c => c[0] === 'setTextColor').pop();
  assert.deepStrictEqual(lastColorBeforeFlag, ['setTextColor', ['black']]);

  const partnerBIndex = doc.calls.findIndex(c => c[0] === 'text' && c[1][0] === '0');
  const lastColorBeforePartnerB = doc.calls.slice(0, partnerBIndex).filter(c => c[0] === 'setTextColor').pop();
  assert.deepStrictEqual(lastColorBeforePartnerB, ['setTextColor', ['black']]);
});

test('renderCategorySection renders each item and returns final y', () => {
  const doc = createDocMock();
  const items = [
    { label: 'First', partnerA: 1, partnerB: 1, match: 100 },
    { label: 'Second', partnerA: 2, partnerB: 3, match: 75 }
  ];
  const margin = 5;
  const usableWidth = doc.internal.pageSize.getWidth() - margin * 2;
  const layout = buildLayout(margin, usableWidth);
  const endY = renderCategorySection(doc, 'MyCat', items, layout, 20);
  assert.strictEqual(endY, 20 + 23 + 12 * items.length);
  const texts = doc.calls.filter(c => c[0] === 'text').map(c => c[1][0]);
  assert(texts.includes('MyCat'));
  assert(texts.includes('First'));
  assert(texts.includes('Second'));
  assert(texts.includes('Partner A'));
  assert(texts.includes('Match'));
  assert(texts.includes('Flag'));
  assert(texts.includes('Partner B'));
});

test('normalizeScore clamps values and handles invalid input', () => {
  assert.strictEqual(normalizeScore(-2), 0);
  assert.strictEqual(normalizeScore(3), 3);
  assert.strictEqual(normalizeScore(9), 5);
  assert.strictEqual(normalizeScore('foo'), null);
});

test('getMatchPercentage uses normalized scores', () => {
  assert.strictEqual(getMatchPercentage(5, 5), 100);
  assert.strictEqual(getMatchPercentage(6, 1), 20);
  assert.strictEqual(getMatchPercentage('N/A', 3), null);
});
