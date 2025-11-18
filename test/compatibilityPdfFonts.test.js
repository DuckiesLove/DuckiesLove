import assert from 'node:assert';
import test from 'node:test';

// Ensure custom font preferences propagate to jsPDF

test('applies configured font family to compatibility PDF', async () => {
  const fontCalls = [];
  class JsPDFMock {
    constructor() {
      this.internal = { pageSize: { getWidth: () => 297, getHeight: () => 210 } };
    }
    setFillColor() {}
    rect() {}
    setTextColor() {}
    setFontSize() {}
    setDrawColor() {}
    setLineWidth() {}
    addPage() {}
    text() {}
    splitTextToSize(value) { return Array.isArray(value) ? value : [value]; }
    save() {}
    setFont(...args) { fontCalls.push(args); }
    addFileToVFS() {}
    addFont() {}
  }

  globalThis.window = { jspdf: { jsPDF: JsPDFMock } };

  const {
    generateCompatibilityPDF,
    setCompatibilityPdfFontSettings,
  } = await import('../js/compatibilityPdf.js');

  setCompatibilityPdfFontSettings(null);
  setCompatibilityPdfFontSettings({ base: { family: 'courier', style: 'normal' } });

  const data = {
    categories: [
      {
        category: 'Demo',
        items: [
          { label: 'Example', partnerA: 3, partnerB: 4 },
        ],
      },
    ],
  };

  await generateCompatibilityPDF(data, { save: false });

  assert.ok(fontCalls.some(([family]) => family === 'courier'));

  setCompatibilityPdfFontSettings(null);
});
