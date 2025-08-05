import test from 'node:test';
import assert from 'node:assert';

// Test that PDF generator draws separate progress bars for partners

test('generates portrait PDF with partner progress bars', async () => {
  const rectCalls = [];
  const textCalls = [];
  let options;

  class JsPDFMock {
    constructor(opts) {
      options = opts;
      this.internal = { pageSize: { getWidth: () => 210, getHeight: () => 297 } };
    }
    setDrawColor() {}
    setFillColor() {}
    rect(...args) { rectCalls.push(args); }
    setTextColor() {}
    setFontSize() {}
    text(...args) { textCalls.push(args); }
    addPage() {}
    save() {}
  }

  globalThis.window = { jspdf: { jsPDF: JsPDFMock } };
  const { generateCompatibilityPDF } = await import('../js/generateCompatibilityPDF.js');

  const data = {
    categories: [
      {
        name: 'Test',
        items: [ { kink: 'Bondage', partnerA: 5, partnerB: 1 } ]
      }
    ]
  };

  generateCompatibilityPDF(data);

  assert.strictEqual(options.orientation, 'portrait');
  assert.ok(textCalls.some(c => c[0] === 'Kink Compatibility Report'));
  // Expect a progress bar width corresponding to partnerB score (1 -> 20% of 30 = 6)
  assert.ok(rectCalls.some(c => c[2] === 6 && c[3] === 4));
  // Numeric scores should be written for both partners
  assert.ok(textCalls.some(c => c[0] === '5'));
  assert.ok(textCalls.some(c => c[0] === '1'));
  // Match percentage with flag should be rendered
  assert.ok(textCalls.some(c => c[0] === '20% 🚩'));
});
