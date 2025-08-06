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
    rect() {}
    addPage() {}
    text(...args) { textCalls.push(args); }
    save() {}
  }

  globalThis.window = {
    jspdf: { jsPDF: JsPDFMock },
    compatibilityData: {
      categories: [
        {
          category: 'Appearance Play',
          items: [
            { label: 'Choosing my partner\'s outfit', partnerA: 0, partnerB: 4 },
            { label: 'Selecting their underwear, lingerie', partnerA: 2, partnerB: 0 }
          ]
        }
      ]
    }
  };

  const { generateCompatibilityPDF } = await import('../js/compatibilityPdf.js');
  generateCompatibilityPDF();

  // Ensure zeros are printed and no N/A appears
  const texts = textCalls.map(c => c[0]);
  assert.ok(texts.includes('0'));
  assert.ok(!texts.includes('N/A'));
});

