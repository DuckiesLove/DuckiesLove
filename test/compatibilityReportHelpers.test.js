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
    setDrawColor: record('setDrawColor'),
    setLineWidth: record('setLineWidth'),
    setTextColor: record('setTextColor'),
    setFontSize: record('setFontSize'),
    text: record('text'),
    splitTextToSize: (value) => (Array.isArray(value) ? value : [value])
  };
}

test('drawMatchBar renders dark bar with colored text and resets color', () => {
  const doc = createDocMock();
  drawMatchBar(doc, 10, 10, 100, 8, 50);
  doc.text('after', 0, 0); // simulate subsequent drawing

  const rectCalls = doc.calls.filter(c => c[0] === 'rect');
  assert.deepStrictEqual(rectCalls[0], ['rect', [10, 10, 100, 8, 'F']]);
  const fillColorCall = doc.calls.find(c => c[0] === 'setFillColor');
  assert.deepStrictEqual(fillColorCall, ['setFillColor', [0, 0, 0]]);

const colorCalls = doc.calls.filter(c => c[0] === 'setTextColor');
assert.deepStrictEqual(colorCalls[0], ['setTextColor', [255, 0, 0]]);
assert.deepStrictEqual(colorCalls[colorCalls.length - 1], ['setTextColor', [255, 255, 255]]);

  const textCall = doc.calls.find(c => c[0] === 'text' && c[1][0] === '50%');
  assert.ok(textCall, 'percentage label should be rendered');
});

test('flag and partner B columns render in white after drawMatchBar', () => {
  const doc = createDocMock();
  const items = [{ label: 'Test', partnerA: 4, partnerB: 0 }]; // results in a 🚩 flag
  const margin = 5;
  const usableWidth = doc.internal.pageSize.getWidth() - margin * 2;
  const layout = buildLayout(margin, usableWidth);
  renderCategorySection(doc, 'Cat', items, layout, 20);

  const flagIndex = doc.calls.findIndex(c => c[0] === 'text' && c[1][0] === '🚩');
  const lastColorBeforeFlag = doc.calls.slice(0, flagIndex).filter(c => c[0] === 'setTextColor').pop();
  assert.deepStrictEqual(lastColorBeforeFlag, ['setTextColor', [255, 255, 255]]);

  const partnerBIndex = doc.calls.findIndex(c => c[0] === 'text' && c[1][0] === '0');
  const lastColorBeforePartnerB = doc.calls.slice(0, partnerBIndex).filter(c => c[0] === 'setTextColor').pop();
  assert.deepStrictEqual(lastColorBeforePartnerB, ['setTextColor', [255, 255, 255]]);
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
  const expectedEndY = 20 + layout.headerHeight + layout.columnHeaderGap + layout.rowHeight * items.length;
  assert.strictEqual(endY, expectedEndY);
  const texts = doc.calls
    .filter(c => c[0] === 'text')
    .flatMap(c => Array.isArray(c[1][0]) ? c[1][0] : [c[1][0]]);
  assert(texts.includes('MyCat'));
  assert(texts.includes('First'));
  assert(texts.includes('Second'));
  assert(texts.includes('Item'));
  assert(texts.includes('Partner A'));
  assert(texts.includes('Match'));
  assert(texts.includes('Flag'));
  assert(texts.includes('Partner B'));
});

test('renderCategorySection draws section outline', () => {
  const doc = createDocMock();
  const margin = 10;
  const layout = buildLayout(margin, 200);
  renderCategorySection(doc, 'Outline', [], layout, 30, {
    textColor: [255, 255, 255],
    borderColor: [200, 200, 200],
    borderWidth: 1,
    padding: 6,
  });

  const rectCalls = doc.calls.filter(c => c[0] === 'rect');
  assert.ok(rectCalls.some(call => call[1][4] === 'S'), 'should draw stroked rectangle');
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
