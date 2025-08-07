import test from 'node:test';
import assert from 'node:assert';

// Ensure the PDF download click handler attaches after DOMContentLoaded

test('PDF download button handler attaches on DOMContentLoaded', async () => {
  let clickHandler;
  const button = {
    addEventListener: (evt, cb) => {
      if (evt === 'click') clickHandler = cb;
    },
  };

  let domReadyHandler;
  const originalGlobals = {
    window: globalThis.window,
    document: globalThis.document,
    alert: globalThis.alert,
    print: globalThis.print,
  };

  try {
    globalThis.window = {
      addEventListener: (evt, cb) => {
        if (evt === 'DOMContentLoaded') domReadyHandler = cb;
      },
      compatibilityData: [],
      html2pdf: () => ({
        set: () => ({
          from: () => ({ save: () => Promise.resolve() })
        })
      }),
    };
    globalThis.document = {
      getElementById: id => (id === 'downloadPdfBtn' ? button : null),
    };
    globalThis.alert = () => {};
    globalThis.print = () => {};

    await import('../js/pdfDownload.js');

    assert.strictEqual(typeof domReadyHandler, 'function');
    domReadyHandler();
    assert.strictEqual(typeof clickHandler, 'function');
  } finally {
    if (originalGlobals.window) globalThis.window = originalGlobals.window; else delete globalThis.window;
    if (originalGlobals.document) globalThis.document = originalGlobals.document; else delete globalThis.document;
    if (originalGlobals.alert) globalThis.alert = originalGlobals.alert; else delete globalThis.alert;
    if (originalGlobals.print) globalThis.print = originalGlobals.print; else delete globalThis.print;
  }
});
