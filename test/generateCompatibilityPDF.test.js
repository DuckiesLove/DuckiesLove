import test from 'node:test';
import assert from 'node:assert';
// Test that PDF generator renders scores and match percentage

test('generates PDF with score columns and percent', async () => {
  const rectCalls = [];
  const textCalls = [];
  const fillCalls = [];

  class JsPDFMock {
    constructor() {
      this.internal = { pageSize: { getWidth: () => 210, getHeight: () => 297 } };
    }
    setFillColor(...args) { fillCalls.push(args); }
    setFont() {}
    setDrawColor() {}
    setLineWidth() {}
    rect(...args) { rectCalls.push(args); }
    setTextColor() {}
    setFontSize() {}
    text(...args) { textCalls.push(args); }
    splitTextToSize(value) { return Array.isArray(value) ? value : [value]; }
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

  const flattened = textCalls.flatMap(call => (Array.isArray(call[0]) ? call[0] : [call[0]]));
  assert.ok(rectCalls.length > 0);
  assert.ok(flattened.includes('Kink Compatibility Report'));
  assert.ok(flattened.includes('Star'));
  assert.ok(flattened.includes('Yellow'));
  assert.ok(flattened.includes('Red'));
  assert.ok(flattened.includes('Partner A'));
  assert.ok(flattened.includes('Partner B'));
  assert.ok(flattened.includes('Flag'));
  // Indicators for various match scenarios now rendered as colored squares
  const paletteCalls = fillCalls
    .map(args => Array.from(args))
    .filter(args => args.length === 3);
  const hasGreen = paletteCalls.some(([r, g, b]) => r === 24 && g === 214 && b === 154);
  const hasYellow = paletteCalls.some(([r, g, b]) => r === 255 && g === 204 && b === 0);
  const hasRed = paletteCalls.some(([r, g, b]) => r === 255 && g === 66 && b === 66);
  assert.ok(hasGreen, 'expected green flag square fill color');
  assert.ok(hasYellow, 'expected yellow flag square fill color');
  assert.ok(hasRed, 'expected red flag square fill color');
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
    setLineWidth() {}
    rect(...args) { rectCalls.push(args); }
    setTextColor() {}
    setFontSize() {}
    text(...args) { textCalls.push(args); }
    splitTextToSize(value) { return Array.isArray(value) ? value : [value]; }
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

  const flattened = textCalls.flatMap(call => (Array.isArray(call[0]) ? call[0] : [call[0]]));
  assert.ok(flattened.includes('N/A'));
  assert.ok(!flattened.some(text => /\d+%/.test(text)));
  assert.ok(!flattened.some(text => text === '⭐' || text === '🚩'));
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
    setLineWidth() {}
    rect() {}
    setTextColor() {}
    setFontSize() {}
    text(...args) { textCalls.push(args); }
    splitTextToSize(value) { return Array.isArray(value) ? value : [value]; }
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
  const flattened = textCalls.flatMap(call => (Array.isArray(call[0]) ? call[0] : [call[0]]));
  assert.ok(flattened.includes('Compatibility History'));
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
    splitTextToSize(value) { return Array.isArray(value) ? value : [value]; }
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
