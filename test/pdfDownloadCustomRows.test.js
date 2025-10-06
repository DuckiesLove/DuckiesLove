import test from 'node:test';
import assert from 'node:assert';

test('downloadCompatibilityPDF uses provided rows and columns', async () => {
  const originalGlobals = {
    window: globalThis.window,
    document: globalThis.document,
    console: globalThis.console,
  };

  try {
    let savedName = '';
    let autoTableOpts = null;

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
      autoTable(opts) { autoTableOpts = opts; }
      addPage() { return this; }
      save(name) { savedName = name; }
    }

    globalThis.console = { warn: () => {}, error: () => {} };
    globalThis.window = {
      jspdf: {
        jsPDF: FakePDF,
        autoTable: () => {},
      },
    };

    globalThis.document = {
      querySelector: () => null,
      querySelectorAll: () => [],
      head: { appendChild: () => {} },
      createElement: () => ({ setAttribute: () => {}, appendChild: () => {}, style: {} }),
      body: { appendChild: () => {} },
    };

    const mod = await import('../js/pdfDownload.js?custom');

    await mod.downloadCompatibilityPDF({
      filename: 'custom.pdf',
      columns: [
        { header: 'Category', dataKey: 'category', align: 'left' },
        { header: 'Partner X', dataKey: 'x', align: 'right' },
      ],
      rows: [
        { category: 'Bondage', x: '5' },
        { category: 'Impact', x: '' },
      ],
    });

    assert.strictEqual(savedName, 'custom.pdf');
    assert.ok(autoTableOpts, 'autoTable should be invoked');
    assert.deepStrictEqual(autoTableOpts.head, [['Category', 'Partner X']]);
    assert.deepStrictEqual(autoTableOpts.body, [
      ['Bondage', '5'],
      ['Impact', '—'],
    ]);
    assert.strictEqual(autoTableOpts.columnStyles[0].halign, 'left');
    assert.strictEqual(autoTableOpts.columnStyles[1].halign, 'right');
  } finally {
    if (originalGlobals.window) globalThis.window = originalGlobals.window; else delete globalThis.window;
    if (originalGlobals.document) globalThis.document = originalGlobals.document; else delete globalThis.document;
    if (originalGlobals.console) globalThis.console = originalGlobals.console; else delete globalThis.console;
  }
});
