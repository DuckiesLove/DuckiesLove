import test from 'node:test';
import assert from 'node:assert/strict';

class JsPDFMock {
  constructor() {
    this.internal = {
      pageSize: {
        getWidth: () => 595.28,
        getHeight: () => 841.89,
      },
    };
    this.autoTableCalls = [];
    this.textCalls = [];
  }
  setFontSize() {}
  setTextColor() {}
  text(...args) {
    this.textCalls.push(args);
  }
  autoTable(opts) {
    this.autoTableCalls.push(opts);
  }
  save() {
    this.saved = true;
  }
}

function setupJsPDFMock() {
  let latestInstance = null;
  class RecordingJsPDF extends JsPDFMock {
    constructor() {
      super();
      latestInstance = this;
    }
  }
  globalThis.window = {
    jspdf: {
      jsPDF: RecordingJsPDF,
    },
  };
  return () => latestInstance;
}

test('talkkink simple compatibility PDF maps rows and adds stars', async () => {
  const getDoc = setupJsPDFMock();

  const { generateCompatibilityPDF } = await import('../js/tkSimpleCompatibilityPdf.js');

  const data = [
    { kink: 'Rope Play', partnerA: 5, partnerB: 5, matchPercent: 100 },
    { kink: 'Impact', partnerA: 2, partnerB: 4, matchPercent: 60 },
  ];

  await generateCompatibilityPDF(data, { save: false });

  const doc = getDoc();
  assert.ok(doc);
  assert.equal(doc.autoTableCalls.length, 1);
  const body = doc.autoTableCalls[0].body;
  assert.deepEqual(body[0], ['Rope Play', '5', '100% ⭐', '5']);
  assert.deepEqual(body[1], ['Impact', '2', '60%', '4']);
});

test('simple compatibility PDF gracefully handles empty rows', async () => {
  const getDoc = setupJsPDFMock();

  const { generateCompatibilityPDF } = await import('../js/tkSimpleCompatibilityPdf.js');
  await generateCompatibilityPDF(null, { save: false });

  const doc = getDoc();
  assert.ok(doc);
  const [[firstRow]] = doc.autoTableCalls[0].body;
  assert.equal(firstRow, '');
});
