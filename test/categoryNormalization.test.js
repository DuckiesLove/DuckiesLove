import test from 'node:test';
import assert from 'node:assert';

test('extractRows normalizes category labels', async () => {
  const originalGlobals = {
    window: globalThis.window,
    document: globalThis.document,
  };
  try {
    let capturedBody = null;
    class FakeJsPDF {
      constructor() {
        this.internal = { pageSize: { getWidth() { return 595; }, getHeight() { return 842; } } };
      }
      setFillColor() {}
      rect() {}
      setTextColor() {}
      setFontSize() {}
      text() {}
      addPage() {}
      autoTable(opts) { capturedBody = opts.body; }
      save() {}
    }

    globalThis.window = { jspdf: { jsPDF: FakeJsPDF, autoTable: (doc, opts) => { capturedBody = opts.body; } } };

    const mkCell = text => ({ textContent: text });
    const mkRow = cells => ({ querySelectorAll: sel => sel === 'td' ? cells : [] });
    const table = {
      querySelectorAll: sel => sel === 'tr'
        ? [
            mkRow([mkCell('CumCum'), mkCell('5'), mkCell('5')]),
            mkRow([mkCell('Cum'), mkCell('4'), mkCell('4')]),
            mkRow([mkCell('Tears/cryingTears/crying'), mkCell('3'), mkCell('3')])
          ]
        : []
    };

    globalThis.document = {
      querySelector: sel => sel === '#compatibilityTable' ? table : null,
      querySelectorAll: () => [],
      head: { appendChild: () => {} },
      createElement: () => ({ setAttribute: () => {}, textContent: '', appendChild: () => {}, style: {} }),
    };

    const mod = await import('../js/pdfDownload.js');
    await mod.downloadCompatibilityPDF();

    assert.deepStrictEqual(
      capturedBody.map(r => r[0]),
      ['Cum Play', 'Cum Play', 'Tears/cryingTears/crying']
    );
  } finally {
    if (originalGlobals.window) globalThis.window = originalGlobals.window; else delete globalThis.window;
    if (originalGlobals.document) globalThis.document = originalGlobals.document; else delete globalThis.document;
  }
});
