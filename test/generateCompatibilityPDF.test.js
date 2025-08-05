import test from 'node:test';
import assert from 'node:assert';

// Test that PDF generator renders scores and match flags

test('generates PDF with score columns and flag', async () => {
  const rectCalls = [];
  const textCalls = [];

  class JsPDFMock {
    constructor() {
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

  assert.ok(rectCalls.length > 0);
  assert.ok(textCalls.some(c => c[0] === 'Kink Compatibility Report'));
  assert.ok(textCalls.some(c => c[0] === 'Bondage'));
  assert.ok(textCalls.some(c => c[0] === '5'));
  assert.ok(textCalls.some(c => c[0] === '1'));
  assert.ok(textCalls.some(c => c[0] === '20% 🚩'));
});
