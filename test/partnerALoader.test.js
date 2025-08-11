import test from 'node:test';
import assert from 'node:assert';

class Element {
  constructor(tagName) {
    this.tagName = tagName.toLowerCase();
    this.children = [];
    this.parentNode = null;
    this.id = '';
    this.className = '';
    this.dataset = {};
    this.attributes = {};
    this.textContent = '';
  }
  appendChild(child) {
    child.parentNode = this;
    this.children.push(child);
    return child;
  }
  insertBefore(child, ref) {
    child.parentNode = this;
    if (!ref) {
      this.children.push(child);
    } else {
      const idx = this.children.indexOf(ref);
      if (idx >= 0) this.children.splice(idx, 0, child); else this.children.push(child);
    }
    return child;
  }
  get cells() {
    return this.children.filter(c => c.tagName === 'td' || c.tagName === 'th');
  }
  querySelector(sel) {
    return this.querySelectorAll(sel)[0] || null;
  }
  querySelectorAll(sel) {
    return queryAll(sel, this);
  }
}

class Document extends Element {
  constructor() {
    super('#document');
    this.listeners = {};
  }
  createElement(tag) {
    return new Element(tag);
  }
  addEventListener(type, cb) {
    (this.listeners[type] ||= []).push(cb);
  }
  dispatchEvent(evt) {
    (this.listeners[evt.type] || []).forEach(fn => fn(evt));
  }
}

function queryAll(selector, ctx) {
  const selectors = selector.split(',').map(s => s.trim()).filter(Boolean);
  const out = new Set();
  for (const sel of selectors) {
    let nodes = [ctx];
    const parts = sel.split(/\s+/);
    for (const part of parts) {
      nodes = nodes.flatMap(n => findDescendants(n, part));
    }
    nodes.forEach(n => out.add(n));
  }
  return [...out];
}

function findDescendants(node, part) {
  const results = [];
  const match = (el) => {
    if (part.startsWith('#')) return el.id === part.slice(1);
    const m = part.match(/^([a-z]+)?(?:\.([\w-]+))?(?:\[([\w-]+)\])?$/i);
    if (!m) return false;
    const [, tag, cls, attr] = m;
    if (tag && el.tagName !== tag.toLowerCase()) return false;
    if (cls && !el.className.split(/\s+/).includes(cls)) return false;
    if (attr && attr.startsWith('data-') && !(attr.slice(5) in el.dataset)) return false;
    return true;
  };
  const traverse = (el) => {
    if (match(el)) results.push(el);
    for (const c of el.children) traverse(c);
  };
  for (const child of node.children) traverse(child);
  return results;
}

test('Partner A column inserted and populated', async () => {
  const document = new Document();
  global.document = document;
  global.window = {};

  const table = document.createElement('table');
  table.id = 'pdf-container';
  document.appendChild(table);

  const header = document.createElement('tr');
  const h1 = document.createElement('th'); h1.textContent = 'Criteria';
  const h2 = document.createElement('th'); h2.textContent = 'Partner B';
  header.appendChild(h1); header.appendChild(h2);
  table.appendChild(header);

  const row = document.createElement('tr');
  row.dataset.key = 'affection';
  const c1 = document.createElement('td'); c1.textContent = 'Affection';
  const c2 = document.createElement('td'); c2.className = 'pb'; c2.textContent = '3';
  row.appendChild(c1); row.appendChild(c2);
  table.appendChild(row);

  const mod = await import('../js/partnerALoader.js');

  document.dispatchEvent({ type: 'DOMContentLoaded' });

  assert.strictEqual(header.cells[1].textContent, 'Partner A');
  assert.strictEqual(row.cells[1].className, 'pa');
  assert.strictEqual(row.cells[1].textContent, '-');

  const realSetTimeout = global.setTimeout;
  global.setTimeout = fn => { fn(); return 0; };
  const file = { text: async () => JSON.stringify({ affection: 7 }) };
  await mod.handlePartnerAUpload(file);
  global.setTimeout = realSetTimeout;

  assert.strictEqual(row.cells[1].textContent, 7);
});
