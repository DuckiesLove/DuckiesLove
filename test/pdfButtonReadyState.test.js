import test from 'node:test';
import assert from 'node:assert';

function createStubButton() {
  const attributes = new Map();
  const handlers = new Map();
  const button = {
    title: '',
    onclick: null,
    _disabled: false,
    addEventListener(type, handler) {
      handlers.set(type, handler);
    },
    getHandler(type) {
      return handlers.get(type);
    },
    setAttribute(name, value) {
      attributes.set(name, String(value));
      if (name === 'disabled') {
        this._disabled = true;
      }
    },
    getAttribute(name) {
      return attributes.has(name) ? attributes.get(name) : null;
    },
    hasAttribute(name) {
      return attributes.has(name);
    },
    toggleAttribute(name, force) {
      const shouldSet = force === undefined ? !attributes.has(name) : Boolean(force);
      if (shouldSet) {
        attributes.set(name, '');
      } else {
        attributes.delete(name);
      }
      if (name === 'disabled') {
        this._disabled = shouldSet;
      }
    },
    removeAttribute(name) {
      attributes.delete(name);
      if (name === 'disabled') {
        this._disabled = false;
      }
    }
  };
  return button;
}

test('bindPdfButton waits for both uploads before enabling download', async () => {
  const originals = {
    window: globalThis.window,
    document: globalThis.document,
    MutationObserver: globalThis.MutationObserver,
    setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout,
    console: globalThis.console,
  };

  try {
    const button = createStubButton();

    const doc = {
      readyState: 'loading',
      head: { appendChild() {} },
      documentElement: {},
      addEventListener() {},
      removeEventListener() {},
      querySelector(selector) {
        return selector === '#downloadBtn' ? button : null;
      },
      querySelectorAll() {
        return [];
      },
      createElement() {
        return { setAttribute() {}, textContent: '', appendChild() {}, style: {} };
      }
    };

    const observers = [];
    class FakeMutationObserver {
      constructor(cb) {
        this._cb = cb;
        observers.push(this);
      }
      observe() {}
      disconnect() {}
      trigger() {
        this._cb();
      }
    }

    let lastTimeout = 0;
    globalThis.setTimeout = (fn) => {
      lastTimeout += 1;
      fn();
      return lastTimeout;
    };
    globalThis.clearTimeout = () => {};

    globalThis.document = doc;
    globalThis.window = { _tkReady: { A: true, B: false } };
    globalThis.MutationObserver = FakeMutationObserver;
    globalThis.console = { warn() {} };

    const mod = await import(`../js/pdfDownload.js?ready-test=${Date.now()}`);

    mod.bindPdfButton();

    assert.strictEqual(button._disabled, true, 'button should stay disabled until both uploads are ready');
    assert.strictEqual(button.getAttribute('data-pdf-ready'), 'false');

    globalThis.window._tkReady.B = true;
    observers.forEach(obs => obs.trigger());

    assert.strictEqual(button._disabled, false, 'button enables after both uploads are marked ready');
    assert.strictEqual(button.getAttribute('data-pdf-ready'), 'true');
  } finally {
    if (originals.window) globalThis.window = originals.window; else delete globalThis.window;
    if (originals.document) globalThis.document = originals.document; else delete globalThis.document;
    if (originals.MutationObserver) globalThis.MutationObserver = originals.MutationObserver; else delete globalThis.MutationObserver;
    if (originals.setTimeout) globalThis.setTimeout = originals.setTimeout; else delete globalThis.setTimeout;
    if (originals.clearTimeout) globalThis.clearTimeout = originals.clearTimeout; else delete globalThis.clearTimeout;
    if (originals.console) globalThis.console = originals.console; else delete globalThis.console;
  }
});
