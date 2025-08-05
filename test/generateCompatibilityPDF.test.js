import test from 'node:test';
import assert from 'node:assert';

// Test that PDF generator creates match bars and flags

test('generates portrait PDF with match bar and flag', async () => {
  const rectCalls = [];
  const textCalls = [];
  let options;

  class JsPDFMock {
    constructor(opts) {
      options = opts;
      this.internal = { pageSize: { getWidth: () => 210, getHeight: () => 297 } };
    }
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
        items: [ { label: 'Bondage', partnerA: 5, partnerB: 1 } ]
      }
    ]
  };

  generateCompatibilityPDF(data);

  assert.strictEqual(options.orientation, 'portrait');
  assert.ok(textCalls.some(c => c[0] === 'Kink Compatibility Report'));
  // For a match of 20%, width should be 10 when barWidth is 50
  assert.ok(rectCalls.some(c => c[2] === 10 && c[3] === 6));
  // Match percentage with flag should be rendered
  assert.ok(textCalls.some(c => c[0] === '20% 🚩'));
});
