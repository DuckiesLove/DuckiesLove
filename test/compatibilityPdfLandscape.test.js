import assert from 'node:assert';
import test from 'node:test';

// The landscape generator relies on jsPDF being available on window.jspdf.
// This test provides a minimal mock implementation to capture calls.

test('generates landscape compatibility PDF with combined scores', async () => {
  const textCalls = [];
  let options;
  class JsPDFMock {
    constructor(opts) {
      options = opts;
      this.internal = {
        pageSize: {
          getWidth: () => 297,
          getHeight: () => 210
        }
      };
    }
    setFont() {}
    setFontSize() {}
    setTextColor() {}
    setFillColor() {}
    rect() {}
    addPage() {}
    text(...args) { textCalls.push(args); }
    splitTextToSize(value) { return Array.isArray(value) ? value : [value]; }
    save() {}
  }

  globalThis.window = { jspdf: { jsPDF: JsPDFMock } };
  const { generateCompatibilityPDFLandscape } = await import('../js/compatibilityPdf.js');

  const data = {
    categories: [
      {
        items: [
          { kink: 'Bondage', partnerA: '5', partnerB: '3' }
        ]
      }
    ]
  };

  await generateCompatibilityPDFLandscape(data);

  assert.strictEqual(options.orientation, 'landscape');
  const flattened = textCalls.flatMap(call => (Array.isArray(call[0]) ? call[0] : [call[0]]));
  assert.ok(flattened.includes('Kink Compatibility Report'));
  assert.ok(flattened.includes('Kink'));
  assert.ok(flattened.includes('Combined Score'));
  assert.ok(flattened.includes('Bondage'));
  assert.ok(flattened.includes('4'));
});
