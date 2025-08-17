import test from 'node:test';
import assert from 'node:assert/strict';
import { loadJsPDF } from '../js/loadJsPDF.js';

test('loadJsPDF loads bundled library without network', async () => {
  globalThis.window = { document: {} };
  const jsPDF = await loadJsPDF();
  assert.equal(jsPDF, window.jspdf.jsPDF);
  assert.equal(typeof jsPDF, 'function');
  delete globalThis.window;
});
