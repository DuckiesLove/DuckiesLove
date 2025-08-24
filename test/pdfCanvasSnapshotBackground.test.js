import test from 'node:test';
import assert from 'node:assert';

// Ensure html2canvas is called with a solid background color when element is transparent

test('downloadCompatibilityPDFCanvas forces solid background color', async () => {
  const original = {
    document: globalThis.document,
    window: globalThis.window,
    html2canvas: globalThis.html2canvas,
    jspdf: globalThis.jspdf,
    jsPDF: globalThis.jsPDF,
    getComputedStyle: globalThis.getComputedStyle,
    CSS: globalThis.CSS,
    requestAnimationFrame: globalThis.requestAnimationFrame,
  };

  try {
    let capturedBg;
    globalThis.html2canvas = async (el, opts) => {
      capturedBg = opts.backgroundColor;
      return { width: 100, height: 100, toDataURL: () => 'data:' };
    };

    class FakePDF {
      constructor() {
        this.internal = { pageSize: { getWidth: () => 100, getHeight: () => 100 } };
      }
      addImage() {}
      save() {}
    }

    globalThis.window = {
      devicePixelRatio: 1,
      html2canvas: globalThis.html2canvas,
      jspdf: { jsPDF: FakePDF },
    };
    globalThis.jspdf = { jsPDF: FakePDF };
    globalThis.getComputedStyle = () => ({
      backgroundColor: 'rgba(0,0,0,0)',
      getPropertyValue: () => '',
    });
    globalThis.CSS = { escape: s => s };
    globalThis.requestAnimationFrame = cb => cb();

    const rootEl = {};
    globalThis.document = {
      querySelector: sel => (sel === '#compatibilityTable' ? rootEl : null),
      documentElement: { scrollWidth: 100, scrollHeight: 100 },
      head: { appendChild: () => {} },
      body: {},
    };

    const { downloadCompatibilityPDFCanvas } = await import('../js/pdfCanvasSnapshot.js');
    await downloadCompatibilityPDFCanvas();
    assert.strictEqual(capturedBg, '#ffffff');
  } finally {
    if (original.document) globalThis.document = original.document; else delete globalThis.document;
    if (original.window) globalThis.window = original.window; else delete globalThis.window;
    if (original.html2canvas) globalThis.html2canvas = original.html2canvas; else delete globalThis.html2canvas;
    if (original.jspdf) globalThis.jspdf = original.jspdf; else delete globalThis.jspdf;
    if (original.jsPDF) globalThis.jsPDF = original.jsPDF; else delete globalThis.jsPDF;
    if (original.getComputedStyle) globalThis.getComputedStyle = original.getComputedStyle; else delete globalThis.getComputedStyle;
    if (original.CSS) globalThis.CSS = original.CSS; else delete globalThis.CSS;
    if (original.requestAnimationFrame) globalThis.requestAnimationFrame = original.requestAnimationFrame; else delete globalThis.requestAnimationFrame;
  }
});
