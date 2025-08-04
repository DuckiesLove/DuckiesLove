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
    save() {}
  }

  globalThis.window = { jspdf: { jsPDF: JsPDFMock } };
  const { generateCompatibilityPDFLandscape } = await import('../js/compatibilityPdf.js');

  const data = {
    categories: [
      {
        items: [
          { kink: 'Bondage', partnerA: 5, partnerB: 3 }
        ]
      }
    ]
  };

  await generateCompatibilityPDFLandscape(data);

  assert.strictEqual(options.orientation, 'landscape');
  assert.ok(textCalls.some(c => c[0] === 'Kink Compatibility Report'));
  assert.ok(textCalls.some(c => c[0] === 'Kink'));
  assert.ok(textCalls.some(c => c[0] === 'Combined Score'));
  assert.ok(textCalls.some(c => c[0] === 'Bondage'));
  assert.ok(textCalls.some(c => c[0] === '4'));
});
