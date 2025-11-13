import test from 'node:test';
import assert from 'node:assert/strict';
import { ensureJsPDF, loadJsPDF, __resetJsPDFForTesting } from '../js/loadJsPDF.js';

test('loadJsPDF loads bundled library without network', async () => {
  globalThis.window = { document: {} };
  const jsPDF = await loadJsPDF();
  assert.equal(jsPDF, window.jspdf.jsPDF);
  assert.equal(typeof jsPDF, 'function');
  delete globalThis.window;
  delete globalThis.jspdf;
  delete globalThis.jsPDF;
  __resetJsPDFForTesting();
});

test('ensureJsPDF works when window is missing', async () => {
  delete globalThis.window;
  delete globalThis.jspdf;
  delete globalThis.jsPDF;
  const jsPDF = await ensureJsPDF();
  assert.equal(typeof jsPDF, 'function');
  assert.ok(globalThis.window);
  assert.equal(globalThis.window.jspdf.jsPDF, jsPDF);
  delete globalThis.window;
  delete globalThis.jspdf;
  delete globalThis.jsPDF;
  __resetJsPDFForTesting();
});
