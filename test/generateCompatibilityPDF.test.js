import test from 'node:test';
import assert from 'node:assert';

test('renders compatibility table with shortened labels and flags', async () => {
  const textCalls = [];
  const tableCalls = [];
  class JsPDFMock {
    constructor() {
      this.internal = { pageSize: { getWidth: () => 210, getHeight: () => 297 } };
    }
    setFontSize() {}
    setTextColor() {}
    setDrawColor() {}
    line() {}
    text(...args) { textCalls.push(args); }
    rect() {}
    autoTable(options) { tableCalls.push(options); }
    save() {}
  }

  globalThis.window = { jspdf: { jsPDF: JsPDFMock } };
  const { generateCompatibilityPDF } = await import('../js/generateCompatibilityPDF.js');

  const data = {
    sectionTitle: 'Discipline Alignment',
    responses: [
      { kink: 'Assigning corner time or time-outs', a: 5, b: 5, match: 100 },
      { kink: 'Attitude toward funishment vs serious correction', a: 5, b: 3 },
      { kink: 'Getting scolded or lectured for correction', a: null, b: null },
    ],
  };

  await generateCompatibilityPDF(data, { save: false });

  const flattenedText = textCalls.flatMap((call) => (Array.isArray(call[0]) ? call[0] : [call[0]]));
  assert.ok(flattenedText.includes('TalkKink Compatibility Survey'));
  assert.ok(flattenedText.includes('Discipline Alignment'));

  const table = tableCalls[0];
  assert.deepStrictEqual(table.head[0], ['Kinks', 'Partner A', '', 'Partner B', 'Match']);
  const body = table.body;
  assert.strictEqual(body[0][0], 'Corner time');
  assert.strictEqual(body[0][2], '⭐');
  assert.strictEqual(body[0][4], 100);
  assert.strictEqual(body[1][2], '🟨');
  assert.strictEqual(body[2][4], 'N/A');
});

test('supports category-based data and derives match percentage', async () => {
  const tableCalls = [];
  class JsPDFMock {
    constructor() {
      this.internal = { pageSize: { getWidth: () => 210, getHeight: () => 297 } };
    }
    setFontSize() {}
    setTextColor() {}
    setDrawColor() {}
    line() {}
    text() {}
    rect() {}
    autoTable(options) { tableCalls.push(options); }
    save() {}
  }

  globalThis.window = { jspdf: { jsPDF: JsPDFMock } };
  const { generateCompatibilityPDF } = await import('../js/generateCompatibilityPDF.js');

  const data = {
    categories: [
      {
        category: 'Test',
        items: [
          { label: 'Sample', partnerA: 4, partnerB: 2 },
        ],
      },
    ],
  };

  await generateCompatibilityPDF(data, { save: false });

  const table = tableCalls[0];
  const row = table.body[0];
  assert.strictEqual(row[0], 'Sample');
  assert.strictEqual(row[4], 60);
});
