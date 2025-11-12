import test from 'node:test';
import assert from 'node:assert';

test('downloadCompatibilityPDF uses provided rows and columns', async () => {
  const originalGlobals = {
    window: globalThis.window,
    document: globalThis.document,
    console: globalThis.console,
  };

  let mod;
  try {
    let savedName = '';
    const textCalls = [];

    class FakePDF {
      constructor(opts = {}) {
        this.opts = opts;
        this.internal = {
          pageSize: {
            getWidth: () => 612,
            getHeight: () => 792,
          },
        };
      }
      setFillColor() {}
      rect() {}
      setTextColor() {}
      setDrawColor() {}
      setLineWidth() {}
      setFont() {}
      setFontSize() {}
      addPage() { return this; }
      text(content, ...rest) {
        const values = Array.isArray(content) ? content : [content];
        values.forEach((value) => textCalls.push(String(value)));
        return rest;
      }
      splitTextToSize(value) { return Array.isArray(value) ? value : [value]; }
      save(name) { savedName = name; }
    }

    globalThis.console = { warn: () => {}, error: () => {}, log: () => {} };
    globalThis.window = {
      jspdf: {
        jsPDF: FakePDF,
      },
    };

    globalThis.document = {
      querySelector: () => null,
      querySelectorAll: () => [],
      head: { appendChild: () => {} },
      createElement: () => ({ setAttribute: () => {}, appendChild: () => {}, style: {} }),
      body: { appendChild: () => {} },
      getElementById: () => null,
    };

    mod = await import('../js/pdfDownload.js?custom');
    mod.__setPdfSaverForTests(async (_doc, name) => {
      savedName = name;
    });

    await mod.downloadCompatibilityPDF({
      filename: 'custom.pdf',
      columns: [
        { header: 'Category', dataKey: 'category', align: 'left' },
        { header: 'Partner A', dataKey: 'a', align: 'right' },
        { header: 'Partner B', dataKey: 'b', align: 'right' },
      ],
      rows: [
        { category: 'Bondage', a: '5', b: '4' },
        { category: 'Impact', a: '0', b: '1' },
      ],
    });

    assert.strictEqual(savedName, 'custom.pdf');
    assert.ok(textCalls.some(t => t.includes('Bondage')));
    assert.ok(textCalls.some(t => t.includes('Impact')));
    assert.ok(textCalls.includes('5'));
    assert.ok(textCalls.includes('0'));
  } finally {
    if (mod?.__resetPdfSaverForTests) mod.__resetPdfSaverForTests();
    if (originalGlobals.window) globalThis.window = originalGlobals.window; else delete globalThis.window;
    if (originalGlobals.document) globalThis.document = originalGlobals.document; else delete globalThis.document;
    if (originalGlobals.console) globalThis.console = originalGlobals.console; else delete globalThis.console;
  }
});
