import test from 'node:test';
import assert from 'node:assert';

// Ensure string-based scores are coerced and rendered

test('renders numeric string scores for both partners', async () => {
  const textCalls = [];

  class JsPDFMock {
    constructor() {
      this.internal = { pageSize: { getWidth: () => 297, getHeight: () => 210 } };
    }
    setFillColor() {}
    setTextColor() {}
    setFontSize() {}
    setDrawColor() {}
    setLineWidth() {}
    rect() {}
    addPage() {}
    text(...args) { textCalls.push(args); }
    splitTextToSize(value) { return Array.isArray(value) ? value : [value]; }
    save() {}
  }

  globalThis.window = { jspdf: { jsPDF: JsPDFMock } };
  const data = {
    categories: [
      {
        category: 'String Scores',
        items: [
          { label: 'Sharing fantasies', partnerA: '5', partnerB: '4' }
        ]
      }
    ]
  };

  const { generateCompatibilityPDF } = await import('../js/compatibilityPdf.js');
  await generateCompatibilityPDF(data);

  const texts = textCalls.flatMap(call => (Array.isArray(call[0]) ? call[0] : [call[0]]));
  assert.ok(texts.includes('5'));
  assert.ok(texts.includes('4'));
  assert.ok(!texts.includes('N/A'));
});
