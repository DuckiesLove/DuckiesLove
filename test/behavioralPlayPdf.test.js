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
  setFillColor() {}
  rect() {}
  setFont() {}
  setFontSize() {}
  setTextColor() {}
  setDrawColor() {}
  setLineWidth() {}
  line() {}
  text(...args) {
    this.textCalls.push(args);
  }
  autoTable(options) {
    this.autoTableCalls.push(options);
  }
  save() {
    this.saved = true;
  }
}

function mockJsPDF() {
  let latestInstance = null;
  class RecordingJsPDF extends JsPDFMock {
    constructor() {
      super();
      latestInstance = this;
    }
  }
  globalThis.window = { jspdf: { jsPDF: RecordingJsPDF } };
  return () => latestInstance;
}

test('behavioral play PDF renders rows and match percent', async () => {
  const getDoc = mockJsPDF();
  const { generateBehavioralPlayPDF } = await import('../js/behavioralPlayPdf.js');

  const rows = [
    { kink: 'Corner time', a: 0, b: 0 },
    { kink: 'Scolding', a: 5, b: 3 },
  ];

  await generateBehavioralPlayPDF(rows, 'dark', { save: false });

  const doc = getDoc();
  assert.ok(doc);
  assert.equal(doc.autoTableCalls.length, 1);
  const body = doc.autoTableCalls[0].body;
  assert.deepEqual(body[0], ['Corner time', '0', '100%', '0']);
  assert.deepEqual(body[1], ['Scolding', '5', '60%', '3']);
});

test('behavioral play PDF skips saving when disabled', async () => {
  const getDoc = mockJsPDF();
  const { generateBehavioralPlayPDF } = await import('../js/behavioralPlayPdf.js');

  await generateBehavioralPlayPDF([], 'dark', { save: false });
  const doc = getDoc();
  assert.ok(doc);
  assert.equal(doc.saved, undefined);
});
