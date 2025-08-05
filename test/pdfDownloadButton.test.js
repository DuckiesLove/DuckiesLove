import test from 'node:test';
import assert from 'node:assert';

// Ensure the PDF download click handler attaches even if the DOM is already loaded

test('PDF download button handler attaches after DOM ready', async () => {
  let handler;
  const button = {
    addEventListener: (evt, cb) => {
      if (evt === 'click') handler = cb;
    },
  };

  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;
  const originalAlert = globalThis.alert;
  const originalPrint = globalThis.print;

  try {
    globalThis.document = {
      readyState: 'complete',
      getElementById: id => (id === 'downloadPdfBtn' ? button : null),
      addEventListener: () => {
        throw new Error('should not wait for DOMContentLoaded');
      },
    };
    globalThis.window = { jspdf: { jsPDF: function jsPDF() {} }, compatibilityData: { categories: [] }, print: () => {} };
    globalThis.alert = () => {};
    globalThis.print = () => {};

    await import('../js/generateCompatibilityPDF.js');

    assert.strictEqual(typeof handler, 'function');
  } finally {
    if (originalDocument) globalThis.document = originalDocument; else delete globalThis.document;
    if (originalWindow) globalThis.window = originalWindow; else delete globalThis.window;
    if (originalAlert) globalThis.alert = originalAlert; else delete globalThis.alert;
    if (originalPrint) globalThis.print = originalPrint; else delete globalThis.print;
  }
});
