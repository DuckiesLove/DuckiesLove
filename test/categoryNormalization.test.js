import test from 'node:test';
import assert from 'node:assert';

test('extractRows normalizes category labels', async () => {
  const originalGlobals = {
    window: globalThis.window,
    document: globalThis.document,
  };
  let mod;
  try {
    const textCalls = [];
    class FakeJsPDF {
      constructor() {
        this.internal = { pageSize: { getWidth() { return 595; }, getHeight() { return 842; } } };
      }
      setFillColor() {}
      rect() {}
      setTextColor() {}
      setFontSize() {}
      setDrawColor() {}
      setLineWidth() {}
      setFont() {}
      text(text) { textCalls.push(String(text)); }
      addPage() {}
      save() {}
    }

    globalThis.window = { jspdf: { jsPDF: FakeJsPDF } };

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
      getElementById: () => null,
    };

    mod = await import('../js/pdfDownload.js');
    mod.__setPdfSaverForTests(() => {});
    await mod.downloadCompatibilityPDF();

    assert.ok(textCalls.includes('Cum Play'));
  } finally {
    if (mod?.__resetPdfSaverForTests) mod.__resetPdfSaverForTests();
    if (originalGlobals.window) globalThis.window = originalGlobals.window; else delete globalThis.window;
    if (originalGlobals.document) globalThis.document = originalGlobals.document; else delete globalThis.document;
  }
});
