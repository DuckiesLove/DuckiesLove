import test from 'node:test';
import assert from 'node:assert';

// Ensure downloadCompatibilityPDF aborts when html2canvas cannot be loaded

test('fails fast when html2canvas is unavailable', async () => {
  const originalGlobals = {
    window: globalThis.window,
    document: globalThis.document,
    alert: globalThis.alert
  };
  try {
    let alertMsg = '';
    globalThis.alert = msg => { alertMsg = msg; };
    globalThis.window = {};
    globalThis.document = {
      readyState: 'complete',
      querySelector: () => null,
      querySelectorAll: () => [],
      head: {
        appendChild: el => {
          if (el && 'src' in el) {
            // simulate script load failure
            setTimeout(() => el.onerror && el.onerror(new Error('fail')), 0);
          }
        }
      },
      createElement: tag => {
        if (tag === 'script') {
          return { onload: null, onerror: null, src: '', setAttribute: () => {}, textContent: '', appendChild: () => {}, style: {} };
        }
        return { setAttribute: () => {}, textContent: '', appendChild: () => {}, style: {} };
      }
    };

    const mod = await import('../js/pdfDownload.js');
    await mod.downloadCompatibilityPDF('light');
    assert.match(alertMsg, /html2canvas/i);
  } finally {
    if (originalGlobals.window) globalThis.window = originalGlobals.window; else delete globalThis.window;
    if (originalGlobals.document) globalThis.document = originalGlobals.document; else delete globalThis.document;
    if (originalGlobals.alert) globalThis.alert = originalGlobals.alert; else delete globalThis.alert;
  }
});
