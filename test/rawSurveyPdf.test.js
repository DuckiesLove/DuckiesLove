import test from 'node:test';
import assert from 'node:assert';

function createDoc() {
  const textCalls = [];
  const doc = {
    y: 20,
    setFontSize() {},
    setTextColor() {},
    setFillColor() {},
    rect() {},
    setFont() {},
    addPage() {},
    internal: { pageSize: { getHeight: () => 200, getWidth: () => 200 } },
    text(...args) { textCalls.push(args); }
  };
  return { doc, textCalls };
}

test('renders categories, scores, matches and flags', async () => {
  const { doc, textCalls } = createDoc();
  const { generateCompatibilityPDF } = await import('../js/helpers/rawSurveyPdf.js');
  const partnerA = { Cat: { Item1: 5, Item2: 4 } };
  const partnerB = { Cat: { Item1: 5, Item2: 3 } };
  generateCompatibilityPDF(partnerA, partnerB, doc);
  const texts = textCalls.map(c => c[0]);
  assert.ok(texts.includes('Cat'));
  assert.ok(texts.includes('Item1'));
  assert.ok(texts.includes('5'));
  assert.ok(texts.includes('100%'));
  assert.ok(texts.includes('⭐'));
  assert.ok(texts.includes('80%'));
});

test('handles missing scores as N/A', async () => {
  const { doc, textCalls } = createDoc();
  const { generateCompatibilityPDF } = await import('../js/helpers/rawSurveyPdf.js');
  const partnerA = { Cat: { Item1: 5 } };
  const partnerB = { Cat: {} };
  generateCompatibilityPDF(partnerA, partnerB, doc);
  const texts = textCalls.map(c => c[0]);
  assert.ok(texts.includes('N/A'));
});
