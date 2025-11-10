import test from 'node:test';
import assert from 'node:assert';

const originalGlobals = {
  window: globalThis.window,
  document: globalThis.document,
  console: globalThis.console,
};

test('downloadCompatibilityPDF builds data from survey inputs', async () => {
  let mod;
  let savedName = '';
  const textCalls = [];

  class FakePDF {
    constructor(opts = {}) {
      this.opts = opts;
      this.internal = {
        pageSize: {
          getWidth: () => 612,
          getHeight: () => 792,
        },
      };
    }
    setFillColor() {}
    rect() {}
    setTextColor() {}
    setDrawColor() {}
    setLineWidth() {}
    setFont() {}
    setFontSize() {}
    addPage() { return this; }
    text(text) {
      textCalls.push(String(text));
      return this;
    }
    save(name) {
      savedName = name;
    }
  }

  try {
    globalThis.console = { warn: () => {}, error: () => {}, log: () => {} };
    globalThis.window = {
      jspdf: { jsPDF: FakePDF },
    };
    globalThis.document = {
      readyState: 'complete',
      querySelector: () => null,
      querySelectorAll: () => [],
      addEventListener: () => {},
      getElementById: () => null,
      createElement: () => ({
        setAttribute: () => {},
        appendChild: () => {},
        style: {},
      }),
      head: { appendChild: () => {} },
      body: { appendChild: () => {} },
      documentElement: {},
    };

    mod = await import('../js/pdfDownload.js?survey-test');
    mod.__setPdfSaverForTests(async (_doc, name) => {
      savedName = name;
    });

    const partnerA = {
      schema: 'talkkink.v2',
      answers: [
        {
          kinkId: 'rope-bondage',
          title: 'Rope Bondage',
          side: 'general',
          score: 5,
          category: 'Bondage & Suspension',
        },
        {
          kinkId: 'impact-play',
          title: 'Impact Play',
          side: 'receiving',
          score: 1,
          category: 'Impact Play',
        },
      ],
    };

    const partnerB = {
      schema: 'talkkink.v2',
      answers: [
        {
          kinkId: 'rope-bondage',
          title: 'Rope Bondage',
          side: 'general',
          score: 3,
          category: 'Bondage & Suspension',
        },
        {
          kinkId: 'impact-play',
          title: 'Impact Play',
          side: 'receiving',
          score: 4,
          category: 'Impact Play',
        },
      ],
    };

    await mod.downloadCompatibilityPDF(partnerA, partnerB, { filename: 'survey.pdf' });

    assert.strictEqual(savedName, 'survey.pdf');
    assert.ok(textCalls.some((t) => t.includes('Bondage')));
    assert.ok(textCalls.some((t) => t.includes('Impact')));
  } finally {
    if (mod?.__resetPdfSaverForTests) mod.__resetPdfSaverForTests();
    if (originalGlobals.window) globalThis.window = originalGlobals.window; else delete globalThis.window;
    if (originalGlobals.document) globalThis.document = originalGlobals.document; else delete globalThis.document;
    if (originalGlobals.console) globalThis.console = originalGlobals.console; else delete globalThis.console;
  }
});
