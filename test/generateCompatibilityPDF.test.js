import test from 'node:test';
import assert from 'node:assert';

// Test that PDF generator renders scores and match percentage

test('generates PDF with score columns and percent', async () => {
  const rectCalls = [];
  const textCalls = [];

  class JsPDFMock {
    constructor() {
      this.internal = { pageSize: { getWidth: () => 210, getHeight: () => 297 } };
    }
    setFillColor() {}
    setFont() {}
    setDrawColor() {}
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
        category: 'Test',
        items: [
          { label: 'Star', partnerA: 5, partnerB: 5 },
          { label: 'Yellow', partnerA: 5, partnerB: 3 },
          { label: 'Red', partnerA: 0, partnerB: 4 }
        ]
      }
    ]
  };

  await generateCompatibilityPDF(data);

  assert.ok(rectCalls.length > 0);
  assert.ok(textCalls.some(c => c[0] === 'Kink Compatibility Report'));
  assert.ok(textCalls.some(c => c[0] === 'Star'));
  assert.ok(textCalls.some(c => c[0] === 'Yellow'));
  assert.ok(textCalls.some(c => c[0] === 'Red'));
  assert.ok(textCalls.some(c => c[0] === 'Partner A'));
  assert.ok(textCalls.some(c => c[0] === 'Partner B'));
  assert.ok(textCalls.some(c => c[0] === 'Flag'));
  // Indicators for various match scenarios
  assert.ok(textCalls.some(c => c[0] === '⭐'));
  assert.ok(textCalls.some(c => c[0] === '🟨'));
  assert.ok(textCalls.some(c => c[0] === '🚩'));
});

test('shows N/A bar when scores missing', async () => {
  const rectCalls = [];
  const textCalls = [];

  class JsPDFMock {
    constructor() {
      this.internal = { pageSize: { getWidth: () => 210, getHeight: () => 297 } };
    }
    setFillColor() {}
    setFont() {}
    setDrawColor() {}
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
        category: 'Test',
        items: [ { label: 'No Data', partnerA: null, partnerB: null } ]
      }
    ]
  };

  await generateCompatibilityPDF(data);

  assert.ok(textCalls.some(c => c[0] === 'N/A'));
  assert.ok(!textCalls.some(c => /\d+%/.test(c[0])));
  assert.ok(!textCalls.some(c => c[0] === '⭐' || c[0] === '🚩'));
});

// New test to verify history section rendering
test('renders compatibility history section when history data present', async () => {
  const textCalls = [];
  class JsPDFMock {
    constructor() {
      this.internal = { pageSize: { getWidth: () => 210, getHeight: () => 297 } };
    }
    setFillColor() {}
    setFont() {}
    setDrawColor() {}
    rect() {}
    setTextColor() {}
    setFontSize() {}
    text(...args) { textCalls.push(args); }
    addPage() {}
    save() {}
  }
  globalThis.window = { jspdf: { jsPDF: JsPDFMock } };
  const { generateCompatibilityPDF } = await import('../js/generateCompatibilityPDF.js');
  const data = {
    categories: [],
    history: [{ score: 85, date: '2024-01-01T00:00:00Z' }]
  };
  await generateCompatibilityPDF(data);
  assert.ok(textCalls.some(c => c[0] === 'Compatibility History'));
});

test('allows custom background and text colors', async () => {
  const fillCalls = [];
  const textColorCalls = [];
  class JsPDFMock {
    constructor() {
      this.internal = { pageSize: { getWidth: () => 210, getHeight: () => 297 } };
    }
    setFillColor(color) { fillCalls.push(color); }
    setFont() {}
    setDrawColor() {}
    rect() {}
    setTextColor(color) { textColorCalls.push(color); }
    setFontSize() {}
    text() {}
    addPage() {}
    save() {}
  }
  globalThis.window = { jspdf: { jsPDF: JsPDFMock } };
  const { generateCompatibilityPDF } = await import('../js/generateCompatibilityPDF.js');
  const data = { categories: [] };
  await generateCompatibilityPDF(data, { backgroundColor: '#ABCDEF', textColor: '#123456' });
  assert.strictEqual(fillCalls[0], '#ABCDEF');
  assert.ok(textColorCalls.includes('#123456'));
});
