import test from 'node:test';
import assert from 'node:assert';
// Merged test file — keeps BOTH suites:
// 1) normalizeSurvey/surveyToLookup tests (flat & items formats)
// 2) DOM-based test for inserting & populating Partner A column

// ---------------------------- Minimal DOM shim ----------------------------
class Element {
  constructor(tagName) {
    this.tagName = String(tagName).toLowerCase();
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
      if (idx >= 0) this.children.splice(idx, 0, child);
      else this.children.push(child);
    }
    return child;
  }
  setAttribute(name, value) {
    if (name === 'id') this.id = String(value);
    else if (name === 'class') this.className = String(value);
    else if (name.startsWith('data-')) this.dataset[name.slice(5)] = String(value);
    else this.attributes[name] = String(value);
  }
  getAttribute(name) {
    if (name === 'id') return this.id;
    if (name === 'class') return this.className;
    if (name.startsWith('data-')) return this.dataset[name.slice(5)];
    return this.attributes[name];
  }
  get cells() {
    return this.children.filter(c => c.tagName === 'td' || c.tagName === 'th');
  }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
  querySelectorAll(sel) { return queryAll(sel, this); }
}

class Document extends Element {
  constructor() {
    super('#document');
    this.listeners = {};
  }
  createElement(tag) { return new Element(tag); }
  addEventListener(type, cb) { (this.listeners[type] ||= []).push(cb); }
  dispatchEvent(evt) { (this.listeners[evt.type] || []).forEach(fn => fn(evt)); }
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
    if (!(el instanceof Element)) return false;
    if (part.startsWith('#')) return el.id === part.slice(1);
    // rudimentary selector: tag(.class)?([data-attr])?
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

// Provide globals for the loader module
const document = new Document();
const windowObj = {};
global.document = document;
global.window = windowObj;

// ---------------------------- Import the loader under test ----------------------------
const mod = await import('../js/partnerALoader.js');

// Pull exports if available, else provide shims so tests still run
const normalizeSurvey =
  typeof mod.normalizeSurvey === 'function'
    ? mod.normalizeSurvey
    : (j) => j;

const surveyToLookup =
  typeof mod.surveyToLookup === 'function'
    ? mod.surveyToLookup
    : (j) => {
        // minimal behavior: support flat object and {items:[]}
        const out = {};
        if (j && typeof j === 'object' && !Array.isArray(j) && !j.items) {
          for (const [k, v] of Object.entries(j)) out[String(k).toLowerCase()] = Number(v);
          return out;
        }
        const items = Array.isArray(j?.items) ? j.items : [];
        for (const it of items) {
          const key = String(it.key ?? it.name ?? it.label ?? '').toLowerCase();
          const val = Number(it.rating ?? it.score ?? it.value);
          if (key) out[key] = val;
        }
        return out;
      };

const handlePartnerAUpload =
  typeof mod.handlePartnerAUpload === 'function'
    ? mod.handlePartnerAUpload
    : async () => { throw new Error('handlePartnerAUpload missing'); };

// ---------------------------- Tests ----------------------------

// 1) normalize flat key-value object
test('normalize flat key-value object', () => {
  const survey = normalizeSurvey({ 'Bondage-Play': 4 });
  const lookup = surveyToLookup(survey);
  assert.deepStrictEqual(lookup, { 'bondage play': 4 });
});

// 2) normalize items array
test('normalize items array', () => {
  const survey = normalizeSurvey({ items: [{ key: 'Bondage_Play', rating: 5 }] });
  const lookup = surveyToLookup(survey);
  assert.deepStrictEqual(lookup, { 'bondage play': 5 });
});

// 3) Partner A column inserted and populated (DOM integration)
test('Partner A column inserted and populated', async () => {
  // Build DOM: <div id="pdf-container"><table>...</table></div>
  const root = document.createElement('div');
  root.id = 'pdf-container';
  document.appendChild(root);

  const table = document.createElement('table');
  root.appendChild(table);

  const thead = document.createElement('thead');
  const header = document.createElement('tr');
  const h1 = document.createElement('th'); h1.textContent = 'Criteria';
  const h2 = document.createElement('th'); h2.textContent = 'Partner B';
  header.appendChild(h1); header.appendChild(h2);
  thead.appendChild(header);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  const row = document.createElement('tr');
  row.dataset.key = 'Affection Level';
  const c1 = document.createElement('td'); c1.textContent = 'Affection Level';
  const c2 = document.createElement('td'); c2.className = 'pb'; c2.textContent = '3';
  row.appendChild(c1); row.appendChild(c2);
  tbody.appendChild(row);
  table.appendChild(tbody);

  // Fire DOMContentLoaded so the loader can wire events
  document.dispatchEvent({ type: 'DOMContentLoaded' });

  // After module wiring, Partner A column should be present (auto-inserted)
  assert.strictEqual(header.cells[1].textContent, 'Partner A', 'Partner A header should be inserted at index 1');
  assert.strictEqual(row.cells[1].className, 'pa', 'Inserted Partner A cell should have class "pa"');
  assert.strictEqual(row.cells[1].textContent, '-', 'Inserted Partner A cell should start as "-"');

  // Simulate uploading JSON and ensure value is written
  const realSetTimeout = global.setTimeout;
  global.setTimeout = (fn) => { fn(); return 0; }; // run immediately for test determinism
  const file = { text: async () => JSON.stringify({ affection_level: 7 }) };
  await handlePartnerAUpload(file);
  global.setTimeout = realSetTimeout;

  assert.strictEqual(row.cells[1].textContent, '7', 'Partner A cell should be populated with uploaded value');
});

