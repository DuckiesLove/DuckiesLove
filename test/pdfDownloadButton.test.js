import test from 'node:test';
import assert from 'node:assert';

// Ensure pdfDownload.js exposes downloadCompatibilityPDF and attaches to window

test('pdf download exporter exposes function on window', async () => {
  const originalGlobals = {
    window: globalThis.window,
    document: globalThis.document,
  };
  try {
    globalThis.window = {};
    globalThis.document = {
      querySelector: () => null,
      head: { appendChild: () => {} },
      createElement: () => ({ setAttribute: () => {}, textContent: '', appendChild: () => {}, style: {} }),
    };
    const mod = await import('../js/pdfDownload.js');
    assert.strictEqual(typeof mod.downloadCompatibilityPDF, 'function');
    assert.strictEqual(typeof globalThis.window.downloadCompatibilityPDF, 'function');
  } finally {
    if (originalGlobals.window) globalThis.window = originalGlobals.window; else delete globalThis.window;
    if (originalGlobals.document) globalThis.document = originalGlobals.document; else delete globalThis.document;
  }
});
