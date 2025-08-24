import test from 'node:test';
import assert from 'node:assert';

test('warns and aborts when both partners have no data', async () => {
  const originalGlobals = {
    window: globalThis.window,
    document: globalThis.document,
    console: globalThis.console,
  };
  try {
    let warnMsg = '';
    let jsPdfCalled = false;

    globalThis.console = { warn: msg => { warnMsg = msg; } };
    globalThis.window = {
      jspdf: {
        jsPDF: class {
          constructor(){
            jsPdfCalled = true;
            this.internal = { pageSize: { getWidth(){ return 595; } } };
          }
          setTextColor(){}
          setFontSize(){}
          text(){}
          autoTable(){}
          save(){}
        },
        autoTable: () => {}
      }
    };
    let disabledState = null;
    const dummyBtn = {
      toggleAttribute: (attr, val) => { if (attr === 'disabled') disabledState = val; },
      setAttribute: () => {},
      title: ''
    };
    globalThis.document = {
      readyState: 'complete',
      querySelector: () => null,
      querySelectorAll: sel => sel === '#downloadBtn, #downloadPdfBtn, [data-download-pdf]' ? [dummyBtn] : [],
      head: { appendChild: () => {} },
      createElement: () => ({ setAttribute: () => {}, textContent: '', appendChild: () => {}, style: {} }),
    };

    const mod = await import('../js/pdfDownload.js?no-data-test');
    await mod.downloadCompatibilityPDF();

    assert.strictEqual(jsPdfCalled, false);
    assert.match(warnMsg, /no data rows/i);
    assert.strictEqual(disabledState, true);
  } finally {
    if (originalGlobals.window) globalThis.window = originalGlobals.window; else delete globalThis.window;
    if (originalGlobals.document) globalThis.document = originalGlobals.document; else delete globalThis.document;
    if (originalGlobals.console) globalThis.console = originalGlobals.console; else delete globalThis.console;
  }
});
