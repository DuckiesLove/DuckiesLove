import test from 'node:test';
import assert from 'node:assert/strict';
import { ensureJsPDF, loadJsPDF, __resetJsPDFForTesting } from '../js/loadJsPDF.js';

function createDocumentStub() {
  const scripts = [];
  const doc = {
    head: {
      appendChild(node) {
        scripts.push(node);
        process.nextTick(() => {
          if (typeof node.onload === 'function') {
            if (!globalThis.window) globalThis.window = {};
            if (!globalThis.window.jspdf) {
              globalThis.window.jspdf = { jsPDF: function MockJsPDF() {} };
            }
            node.dataset = node.dataset || {};
            node.dataset.loaded = '1';
            node.onload();
          }
        });
      }
    },
    createElement(tag) {
      if (tag !== 'script') throw new Error('Unexpected tag');
      return {
        dataset: {},
        addEventListener(type, cb) {
          this[`on${type}`] = cb;
        },
      };
    },
    querySelector(selector) {
      if (selector === 'script[data-lib="jspdf"]') {
        return scripts.find(node => node.dataset && node.dataset.lib === 'jspdf') || null;
      }
      const srcMatch = selector.match(/^script\[src="(.+)"\]$/);
      if (srcMatch) {
        return scripts.find(node => node.src === srcMatch[1]) || null;
      }
      return null;
    },
  };
  return doc;
}

test('loadJsPDF injects the CDN script when jsPDF is missing', async () => {
  const documentStub = createDocumentStub();
  globalThis.window = { document: documentStub };
  globalThis.document = documentStub;

  const jsPDF = await loadJsPDF();

  assert.equal(typeof jsPDF, 'function');
  assert.equal(jsPDF, window.jspdf.jsPDF);

  delete globalThis.window;
  delete globalThis.document;
  delete globalThis.jspdf;
  delete globalThis.jsPDF;
  __resetJsPDFForTesting();
});

test('ensureJsPDF recovers when window is missing', async () => {
  const documentStub = createDocumentStub();
  globalThis.document = documentStub;
  delete globalThis.window;
  delete globalThis.jspdf;
  delete globalThis.jsPDF;

  const jsPDF = await ensureJsPDF();

  assert.equal(typeof jsPDF, 'function');
  assert.ok(globalThis.window);
  assert.equal(globalThis.window.jspdf.jsPDF, jsPDF);

  delete globalThis.window;
  delete globalThis.document;
  delete globalThis.jspdf;
  delete globalThis.jsPDF;
  __resetJsPDFForTesting();
});
