import test from 'node:test';
import assert from 'node:assert';

// Ensure zero scores are rendered as numeric values and not mistaken for 'N/A'
test('renders zero scores for both partners', async () => {
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
        category: 'Appearance Play',
        items: [
          { label: 'Choosing my partner\'s outfit', partnerA: 0, partnerB: 4 },
          { label: 'Selecting their underwear, lingerie', partnerA: 2, partnerB: 0 }
        ]
      }
    ]
  };

  const { generateCompatibilityPDF } = await import('../js/compatibilityPdf.js');
  await generateCompatibilityPDF(data);

  // Ensure zeros are printed and no N/A appears
  const texts = textCalls.flatMap(call => (Array.isArray(call[0]) ? call[0] : [call[0]]));
  assert.ok(texts.includes('0'));
  assert.ok(!texts.includes('N/A'));
});

