import test from 'node:test';
import assert from 'node:assert';

// Verify html2canvas background color defaults to null (no forced black)

test('renderMultiPagePDF passes null backgroundColor when none supplied', async () => {
  const original = {
    document: globalThis.document,
    html2canvas: globalThis.html2canvas,
    window: globalThis.window,
  };

  try {
    let capturedBg;
    globalThis.html2canvas = async (el, opts) => {
      capturedBg = opts.backgroundColor;
      return { toDataURL: () => '' };
    };

    globalThis.document = {
      readyState: 'complete',
      addEventListener: () => {},
      documentElement: { clientWidth: 100 },
      createElement: () => ({
        setAttribute: () => {},
        textContent: '',
        appendChild: () => {},
        style: {},
      }),
      querySelector: () => null,
      querySelectorAll: () => [],
      head: { appendChild: () => {} },
    };
    globalThis.window = {};

    const clone = {
      scrollWidth: 100,
      scrollHeight: 100,
      getBoundingClientRect: () => ({ width: 100, height: 100, top: 0 }),
      querySelectorAll: () => [],
    };

    class FakePDF {
      constructor() {
        this.internal = { pageSize: { getWidth: () => 612, getHeight: () => 792 } };
      }
      addPage() {}
      addImage() {}
      setFillColor() {}
      rect() {}
      setTextColor() {}
      setFont() {}
      setFontSize() {}
      text() {}
    }

    const { renderMultiPagePDF } = await import('../js/pdfDownload.js');
    await renderMultiPagePDF({ clone, jsPDFCtor: FakePDF, firstPageHeader: '' });

    assert.strictEqual(capturedBg, null);
  } finally {
    if (original.document) globalThis.document = original.document; else delete globalThis.document;
    if (original.html2canvas) globalThis.html2canvas = original.html2canvas; else delete globalThis.html2canvas;
    if (original.window) globalThis.window = original.window; else delete globalThis.window;
  }
});
