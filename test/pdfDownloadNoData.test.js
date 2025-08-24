import test from 'node:test';
import assert from 'node:assert';

test('alerts and aborts when both partners have no data', async () => {
  const originalGlobals = {
    window: globalThis.window,
    document: globalThis.document,
    alert: globalThis.alert,
  };
  try {
    let alertMsg = '';
    let jsPdfCalled = false;

    globalThis.alert = msg => { alertMsg = msg; };
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
    globalThis.document = {
      readyState: 'complete',
      querySelector: () => null,
      querySelectorAll: () => [],
      head: { appendChild: () => {} },
      createElement: () => ({ setAttribute: () => {}, textContent: '', appendChild: () => {}, style: {} }),
    };

    const mod = await import('../js/pdfDownload.js?no-data-test');
    await mod.downloadCompatibilityPDF();

    assert.strictEqual(jsPdfCalled, false);
    assert.match(alertMsg, /no data rows/i);
  } finally {
    if (originalGlobals.window) globalThis.window = originalGlobals.window; else delete globalThis.window;
    if (originalGlobals.document) globalThis.document = originalGlobals.document; else delete globalThis.document;
    if (originalGlobals.alert) globalThis.alert = originalGlobals.alert; else delete globalThis.alert;
  }
});
