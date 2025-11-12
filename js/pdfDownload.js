import { savePDF as savePdfDownload } from './talkKinkDownload.js';
import { loadJsPDF } from './loadJsPDF.js';

let pdfSaver = savePdfDownload;

export function __setPdfSaverForTests(fn) {
  pdfSaver = typeof fn === 'function' ? fn : savePdfDownload;
}

export function __resetPdfSaverForTests() {
  pdfSaver = savePdfDownload;
}

'use strict';

const BTN_SELECTORS = ['#downloadBtn', '#downloadPdfBtn', '[data-download-pdf]'];
const READY_ATTR = 'data-pdf-ready';
const BOUND_ATTR = 'data-pdf-bound';

const DEFAULT_COLUMNS = [
  { header: 'Category', dataKey: 'category', align: 'left' },
  { header: 'Partner A', dataKey: 'a', align: 'center' },
  { header: 'Match %', dataKey: 'pct', align: 'center' },
  { header: 'Partner B', dataKey: 'b', align: 'center' },
];

const DEFAULT_CATEGORY = 'Compatibility';

function getDocument(){
  return typeof document === 'undefined' ? null : document;
}

function getWindow(){
  return typeof window === 'undefined' ? null : window;
}

function uniqueNodes(nodes){
  const out = [];
  const seen = new Set();
  nodes.forEach(node => {
    if (!node || seen.has(node)) return;
    seen.add(node);
    out.push(node);
  });
  return out;
}

function queryButtons(){
  const doc = getDocument();
  if (!doc || typeof doc.querySelectorAll !== 'function') return [];
  const found = [];
  BTN_SELECTORS.forEach(sel => {
    try {
      let nodes = [];
      if (typeof doc.querySelectorAll === 'function') {
        const list = doc.querySelectorAll(sel) || [];
        if (list && typeof list.forEach === 'function') {
          list.forEach(node => nodes.push(node));
        } else {
          nodes = Array.from(list);
        }
      }
      if (!nodes.length && typeof doc.querySelector === 'function') {
        const single = doc.querySelector(sel);
        if (single) nodes.push(single);
      }
      nodes.forEach(node => found.push(node));
    } catch (_) {
      /* ignore invalid selectors */
    }
  });
  if (!found.length && typeof doc.querySelectorAll === 'function') {
    try {
      const combined = doc.querySelectorAll(BTN_SELECTORS.join(', ')) || [];
      if (typeof combined.forEach === 'function') {
        combined.forEach(node => found.push(node));
      } else {
        Array.from(combined).forEach(node => found.push(node));
      }
    } catch (_) {
      /* ignore */
    }
  }
  return uniqueNodes(found);
}

function setButtonState(btn, ready){
  if (!btn) return;
  try {
    if (typeof btn.toggleAttribute === 'function') {
      btn.toggleAttribute('disabled', !ready);
    } else if (ready) {
      btn.removeAttribute?.('disabled');
    } else {
      btn.setAttribute?.('disabled', 'disabled');
    }
    btn.setAttribute?.(READY_ATTR, ready ? 'true' : 'false');
    btn.setAttribute?.('aria-disabled', ready ? 'false' : 'true');
    if (typeof btn.title === 'string') {
      btn.title = ready ? 'Download PDF' : 'Load both surveys to enable';
    }
  } catch (_) {
    /* noop */
  }
}

function disableButtonsForNoData(){
  queryButtons().forEach(btn => {
    if (typeof btn.toggleAttribute === 'function') {
      btn.toggleAttribute('disabled', true);
    } else {
      btn.setAttribute?.('disabled', 'disabled');
    }
    btn.setAttribute?.(READY_ATTR, 'false');
    btn.setAttribute?.('aria-disabled', 'true');
    if (typeof btn.title === 'string') {
      btn.title = 'Load both surveys to enable';
    }
  });
}

function isNumericText(value){
  if (value == null) return false;
  const num = Number(String(value).trim());
  return Number.isFinite(num);
}

function countPartnerCells(){
  const doc = getDocument();
  if (!doc || typeof doc.querySelectorAll !== 'function') {
    return { aCount: 0, bCount: 0 };
  }
  const rows = doc.querySelectorAll(
    '#compatibilityTable tbody tr, table.results-table.compat tbody tr, table tbody tr'
  );
  let aCount = 0;
  let bCount = 0;
  rows && rows.forEach?.(tr => {
    const query = typeof tr.querySelector === 'function' ? tr.querySelector.bind(tr) : () => null;
    const allCells = tr.querySelectorAll ? tr.querySelectorAll('td') : [];
    const aCell = query('td[data-cell="A"]');
    const bCell = query('td[data-cell="B"]');
    const getText = (node, fallbackIndex) => {
      if (node && typeof node.textContent === 'string') return node.textContent;
      if (allCells && allCells.length && fallbackIndex != null) {
        const cell = allCells[fallbackIndex];
        if (cell && typeof cell.textContent === 'string') return cell.textContent;
      }
      return '';
    };
    const aVal = getText(aCell, 1);
    const bVal = getText(bCell, allCells.length ? allCells.length - 1 : null);
    if (isNumericText(aVal)) aCount += 1;
    if (isNumericText(bVal)) bCount += 1;
  });
  return { aCount, bCount };
}

function computeReady(){
  const win = getWindow();
  if (win && typeof win._tkReady === 'object' && win._tkReady !== null) {
    const state = win._tkReady;
    if (Object.prototype.hasOwnProperty.call(state, 'A') || Object.prototype.hasOwnProperty.call(state, 'B')) {
      return Boolean(state.A) && Boolean(state.B);
    }
  }
  const counts = countPartnerCells();
  return counts.aCount > 0 && counts.bCount > 0 && counts.aCount === counts.bCount;
}

function isPlainObject(value){
  if (!value || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function normalizeColumns(columns){
  const source = Array.isArray(columns) && columns.length ? columns : DEFAULT_COLUMNS;
  return source.map((col, idx) => {
    if (typeof col === 'string') {
      return {
        header: col,
        dataKey: col,
        align: idx === 0 ? 'left' : 'center',
      };
    }
    const header = col.header ?? col.title ?? col.label ?? '';
    const dataKey = col.dataKey ?? col.key ?? col.field ?? col.name ?? col.header ?? col.title;
    return {
      header: header || String(dataKey ?? ''),
      dataKey,
      align: col.align || col.halign || (idx === 0 ? 'left' : 'center'),
      cellWidth: col.cellWidth,
    };
  });
}

function findTable(){
  const doc = getDocument();
  if (!doc || typeof doc.querySelector !== 'function') return null;
  const selectors = ['#compatibilityTable', '.results-table.compat', 'table'];
  for (const sel of selectors) {
    try {
      const table = doc.querySelector(sel);
      if (table && typeof table.querySelectorAll === 'function') {
        return table;
      }
    } catch (_) {
      /* ignore */
    }
  }
  return null;
}

function clampScore(n){
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 5) return 5;
  return Math.round(n);
}

function ensureObject(value){
  if (!value) return null;
  if (typeof value === 'object') return value;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch (_) {
      return null;
    }
  }
  return null;
}

function extractRows(table){
  const rows = [];
  const trList = table.querySelectorAll ? table.querySelectorAll('tr') : [];
  trList && trList.forEach?.(tr => {
    const cells = tr.querySelectorAll ? tr.querySelectorAll('td') : [];
    if (!cells || cells.length === 0) return;
    const texts = [];
    cells.forEach?.(td => {
      const text = (td.textContent || '')
        .replace(/\s+/g, ' ')
        .replace(/([A-Za-z]+)\s*\1/, '$1')
        .trim();
      texts.push(text);
    });
    if (!texts.length) return;
    let category = texts[0] || '—';
    if (/^cum$/i.test(category)) category = 'Cum Play';

    const numericValues = texts
      .map(val => Number(String(val).replace(/[^\d.-]/g, '')))
      .filter(num => Number.isFinite(num));

    if (!numericValues.length && texts.slice(1).every(t => !t)) {
      rows.push({ type: 'header', category });
      return;
    }

    const aScore = numericValues.length ? clampScore(numericValues[0]) : '—';
    const bScore = numericValues.length > 1 ? clampScore(numericValues[numericValues.length - 1]) : '—';

    let pct = texts.find(t => /%$/.test(t)) || null;
    if (!pct && typeof aScore === 'number' && typeof bScore === 'number') {
      const diff = Math.abs(aScore - bScore);
      const calc = Math.round(100 - (diff / 5) * 100);
      pct = `${Math.max(0, Math.min(100, calc))}%`;
    }

    rows.push({
      type: 'row',
      category,
      A: typeof aScore === 'number' ? aScore : '—',
      pct: pct || '—',
      B: typeof bScore === 'number' ? bScore : '—',
    });
  });
  return rows;
}

function parseOptions(args){
  if (!args.length) return {};
  if (args.length === 1 && isPlainObject(args[0])) return args[0] || {};
  const opts = isPlainObject(args[2]) ? { ...args[2] } : {};
  if (args[0] != null) opts.partnerA = args[0];
  if (args[1] != null) opts.partnerB = args[1];
  return opts;
}

function parseScoreValue(value){
  if (value == null) return null;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? clampScore(value) : null;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed || trimmed === '—' || trimmed.toLowerCase() === 'n/a') return null;
    const num = Number(trimmed.replace(/[^\d.-]/g, ''));
    return Number.isFinite(num) ? clampScore(num) : null;
  }
  return null;
}

function parseMatchValue(value){
  if (value == null) return null;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    return Math.max(0, Math.min(100, Math.round(value)));
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed || trimmed === '—' || trimmed.toLowerCase() === 'n/a') return null;
    const num = Number(trimmed.replace(/[^\d.-]/g, ''));
    if (!Number.isFinite(num)) return null;
    return Math.max(0, Math.min(100, Math.round(num)));
  }
  return null;
}

function normalizeProvidedRow(row, columns){
  if (Array.isArray(row)) return row;
  if (!row || typeof row !== 'object') return columns.map(() => '—');
  return columns.map(col => {
    const key = col.dataKey;
    if (key != null && Object.prototype.hasOwnProperty.call(row, key)) {
      return row[key];
    }
    if (col.header && Object.prototype.hasOwnProperty.call(row, col.header)) {
      return row[col.header];
    }
    if (col.label && Object.prototype.hasOwnProperty.call(row, col.label)) {
      return row[col.label];
    }
    return '—';
  });
}

function resolveColumnIndex(columns, matcher, fallback){
  const idx = columns.findIndex(col => matcher((col.header || '').toLowerCase()));
  return idx >= 0 ? idx : fallback;
}

function buildCategoriesFromProvidedRows(rows, columns){
  if (!Array.isArray(rows) || !rows.length) return [];
  const arrays = rows.map(row => normalizeProvidedRow(row, columns));
  if (!arrays.length) return [];

  const labelIdx = resolveColumnIndex(columns, text => /category|item|kink|name/.test(text), 0);
  const aIdx = resolveColumnIndex(columns, text => /partner\s*a/.test(text), Math.min(1, arrays[0].length - 1));
  const bIdx = resolveColumnIndex(columns, text => /partner\s*b/.test(text), arrays[0].length - 1);
  const matchIdx = resolveColumnIndex(columns, text => /match/.test(text), -1);

  const category = { category: 'Compatibility', items: [] };
  arrays.forEach(values => {
    const label = values[labelIdx] ?? '';
    const aScore = parseScoreValue(values[aIdx]);
    const bScore = parseScoreValue(values[bIdx]);
    const match = matchIdx >= 0 ? parseMatchValue(values[matchIdx]) : null;

    if (!label && aScore == null && bScore == null) {
      return;
    }

    category.items.push({
      label: String(label || ''),
      partnerA: aScore,
      partnerB: bScore,
      match: match ?? undefined,
    });
  });

  return category.items.length ? [category] : [];
}

function buildCategoriesFromExtractedRows(extracted){
  if (!Array.isArray(extracted) || !extracted.length) return [];
  const categories = [];
  let current = null;

  const startCategory = label => {
    const name = label && label !== '—' ? String(label) : 'Compatibility';
    current = { category: name, items: [] };
    categories.push(current);
  };

  extracted.forEach(row => {
    if (row.type === 'header') {
      startCategory(row.category);
      return;
    }

    if (!current) {
      startCategory('Compatibility');
    }

    const aScore = parseScoreValue(row.A);
    const bScore = parseScoreValue(row.B);
    const match = parseMatchValue(row.pct);

    current.items.push({
      label: String(row.category || ''),
      partnerA: aScore,
      partnerB: bScore,
      match: match ?? undefined,
    });
  });

  return categories.filter(cat => cat.items.length);
}

function normalizeCategoryInput(cat){
  if (!cat || typeof cat !== 'object') return null;
  const rawItems = Array.isArray(cat.items) ? cat.items : [];
  const items = rawItems
    .map(item => {
      if (!item || typeof item !== 'object') return null;
      const label = item.label || item.name || '';
      const partnerA = parseScoreValue(item.partnerA ?? item.a ?? item.scoreA);
      const partnerB = parseScoreValue(item.partnerB ?? item.b ?? item.scoreB);
      const match = parseMatchValue(item.match);
      if (!label && partnerA == null && partnerB == null) {
        return null;
      }
      return {
        label: String(label || ''),
        partnerA,
        partnerB,
        match: match ?? undefined,
      };
    })
    .filter(Boolean);

  if (!items.length) return null;
  return { category: cat.category || cat.name || 'Compatibility', items };
}

function normalizeSideLabel(side){
  if (!side) return '';
  const clean = String(side).trim();
  if (!clean || clean.toLowerCase() === 'general') return '';
  return ` (${clean.replace(/[_-]+/g, ' ').replace(/\b\w/g, ch => ch.toUpperCase())})`;
}

function extractSurveyEntries(rawSurvey){
  const survey = ensureObject(rawSurvey);
  if (!survey) return [];

  const entries = new Map();

  const addEntry = ({ category, id, label, score, side }) => {
    if (score == null && score !== 0) return;
    const catName = category ? String(category) : DEFAULT_CATEGORY;
    const keyBase = id != null ? String(id) : String(label || '');
    const key = side ? `${keyBase}::${side}` : keyBase;
    const mapKey = `${catName}||${key}`;
    if (!mapKey.trim()) return;
    const displayLabel = (label ? String(label) : keyBase) + normalizeSideLabel(side);
    if (!entries.has(mapKey)) {
      entries.set(mapKey, { category: catName, key, label: displayLabel, score });
      return;
    }
    const existing = entries.get(mapKey);
    if (existing.score == null && score != null) existing.score = score;
    if (!existing.label && displayLabel) existing.label = displayLabel;
  };

  const fromAnswersArray = Array.isArray(survey.answers) ? survey.answers : null;
  if (fromAnswersArray) {
    fromAnswersArray.forEach((ans) => {
      if (!ans || typeof ans !== 'object') return;
      const rawScore = ans.score ?? ans.value ?? ans.rating ?? ans.answer ?? ans.response;
      const score = parseScoreValue(rawScore);
      const category = ans.category ?? ans.categoryName ?? ans.categoryId ?? ans.section ?? ans.group;
      const id = ans.kinkId ?? ans.id ?? ans.key ?? ans.questionId ?? ans.promptId ?? ans.code;
      const label = ans.title ?? ans.prompt ?? ans.question ?? ans.label ?? ans.name ?? ans.kink ?? ans.text ?? id;
      const side = ans.side ?? ans.channel ?? ans.role ?? ans.position ?? ans.context;
      addEntry({ category, id, label, score, side });
    });
  }

  const fromResponses = Array.isArray(survey.responses) ? survey.responses : null;
  if (fromResponses) {
    fromResponses.forEach((row, idx) => {
      if (!row || typeof row !== 'object') return;
      const rawScore = row.score ?? row.value ?? row.rating ?? row.answer ?? row.response ?? row.selected;
      const score = parseScoreValue(rawScore);
      const category = row.category ?? row.section ?? row.group ?? row.categoryId;
      const id = row.id ?? row.kinkId ?? row.key ?? row.promptId ?? idx;
      const label = row.prompt ?? row.text ?? row.title ?? row.label ?? row.name ?? id;
      const side = row.side ?? row.channel ?? row.role ?? row.position ?? row.context;
      addEntry({ category, id, label, score, side });
    });
  }

  const itemsArray = Array.isArray(survey.items) ? survey.items : null;
  if (itemsArray) {
    itemsArray.forEach((item, idx) => {
      if (!item || typeof item !== 'object') return;
      const rawScore = item.score ?? item.value ?? item.rating ?? item.answer ?? item.response;
      const score = parseScoreValue(rawScore);
      const category = item.category ?? item.section ?? item.group ?? item.categoryId;
      const id = item.id ?? item.kinkId ?? item.key ?? idx;
      const label = item.title ?? item.prompt ?? item.text ?? item.label ?? item.name ?? id;
      const side = item.side ?? item.channel ?? item.role ?? item.position ?? item.context;
      addEntry({ category, id, label, score, side });
    });
  }

  const answersObj = survey.answers && typeof survey.answers === 'object' && !Array.isArray(survey.answers)
    ? survey.answers
    : null;
  if (answersObj) {
    Object.entries(answersObj).forEach(([id, rawScore]) => {
      const score = parseScoreValue(rawScore);
      addEntry({ category: DEFAULT_CATEGORY, id, label: id, score, side: null });
    });
  }

  const byKink = survey.byKinkId || survey.byKink;
  if (byKink && typeof byKink === 'object') {
    Object.entries(byKink).forEach(([id, value]) => {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        const baseLabel = value.title ?? value.name ?? value.label ?? id;
        const category = value.category ?? value.categoryName ?? value.categoryId ?? value.section;
        Object.entries(value).forEach(([side, rawScore]) => {
          if (side == null) return;
          if (/^(title|name|label|category|categoryId|categoryName|section|meta)$/i.test(side)) return;
          const score = parseScoreValue(rawScore);
          addEntry({ category, id: `${id}::${side}`, label: baseLabel, score, side });
        });
      } else {
        const score = parseScoreValue(value);
        addEntry({ category: DEFAULT_CATEGORY, id, label: id, score, side: null });
      }
    });
  }

  return Array.from(entries.values());
}

function buildCategoriesFromSurveys(partnerAInput, partnerBInput){
  const aEntries = extractSurveyEntries(partnerAInput);
  const bEntries = extractSurveyEntries(partnerBInput);

  if (!aEntries.length && !bEntries.length) return [];

  const categories = new Map();

  const applyEntries = (list, sideKey) => {
    list.forEach((entry) => {
      const catName = entry.category || DEFAULT_CATEGORY;
      let bucket = categories.get(catName);
      if (!bucket) {
        bucket = { category: catName, items: [], index: new Map() };
        categories.set(catName, bucket);
      }
      const itemKey = entry.key || entry.label || String(bucket.items.length);
      let item = bucket.index.get(itemKey);
      if (!item) {
        item = { label: entry.label || itemKey, partnerA: null, partnerB: null };
        bucket.index.set(itemKey, item);
        bucket.items.push(item);
      } else if (!item.label && entry.label) {
        item.label = entry.label;
      }
      if (entry.score != null) {
        item[sideKey] = entry.score;
      }
    });
  };

  applyEntries(aEntries, 'partnerA');
  applyEntries(bEntries, 'partnerB');

  const result = Array.from(categories.values())
    .map((cat) => {
      const items = cat.items
        .filter((item) => !(item.partnerA == null && item.partnerB == null))
        .sort((a, b) => String(a.label || '').localeCompare(String(b.label || ''), undefined, { sensitivity: 'base' }));
      return items.length ? { category: cat.category, items } : null;
    })
    .filter(Boolean)
    .sort((a, b) => String(a.category || '').localeCompare(String(b.category || ''), undefined, { sensitivity: 'base' }));

  return result;
}

function getHistoryData(options){
  if (options && Array.isArray(options.history)) {
    return options.history;
  }
  const win = getWindow();
  if (win && Array.isArray(win.compatibilityHistory)) {
    return win.compatibilityHistory;
  }
  return [];
}

async function ensureJsPdfReady(){
  try {
    await loadJsPDF();
  } catch (error) {
    console.error('jsPDF failed to load', error);
    throw error;
  }
}

export async function downloadCompatibilityPDF(...args){
  const options = parseOptions(args);
  const {
    filename = 'compatibility-report.pdf',
    columns,
    rows,
    categories,
  } = options;

  let pdfCategories = [];

  if (Array.isArray(categories) && categories.length) {
    pdfCategories = categories
      .map(normalizeCategoryInput)
      .filter(Boolean);
  } else if (Array.isArray(rows) && rows.length) {
    const columnDefs = normalizeColumns(columns);
    pdfCategories = buildCategoriesFromProvidedRows(rows, columnDefs);
  } else {
    const fromSurveys = buildCategoriesFromSurveys(options.partnerA, options.partnerB);
    if (fromSurveys.length) {
      pdfCategories = fromSurveys;
    } else {
      const table = findTable();
      if (!table) {
        console.warn('[pdf] No data rows found to export.');
        disableButtonsForNoData();
        return;
      }
      const extracted = extractRows(table);
      pdfCategories = buildCategoriesFromExtractedRows(extracted);
    }
  }

  if (!pdfCategories.length) {
    console.warn('[pdf] No data rows found to export.');
    disableButtonsForNoData();
    return;
  }

  await ensureJsPdfReady();

  const { generateCompatibilityPDF } = await import('./compatibilityPdf.js');

  const history = getHistoryData(options);
  const data = { categories: pdfCategories, history };

  const saveHook = async (doc, name) => {
    if (typeof pdfSaver === 'function') {
      try {
        await pdfSaver(doc, name);
        return;
      } catch (error) {
        console.error('[pdf] download helper failed, falling back to jsPDF.save()', error);
      }
    }
    if (typeof doc.save === 'function') {
      doc.save(name);
    }
  };

  await generateCompatibilityPDF(data, { filename, saveHook });
}

export function bindPdfButton(){
  const [btn] = queryButtons();
  if (!btn || btn.hasAttribute?.(BOUND_ATTR)) return;

  btn.onclick = null;

  const updateState = () => {
    const ready = computeReady();
    setButtonState(btn, ready);
  };

  btn.addEventListener?.('click', ev => {
    ev?.preventDefault?.();
    ev?.stopImmediatePropagation?.();
    const ready = btn.getAttribute?.(READY_ATTR) === 'true';
    if (!ready) {
      console.warn('[pdf] Not ready: load both surveys before exporting.');
      return;
    }
    downloadCompatibilityPDF();
  }, true);

  btn.setAttribute?.(BOUND_ATTR, 'true');

  let debounce = null;
  const scheduleUpdate = () => {
    if (debounce != null && typeof clearTimeout === 'function') {
      clearTimeout(debounce);
    }
    if (typeof setTimeout === 'function') {
      debounce = setTimeout(updateState, 50);
    } else {
      debounce = null;
      updateState();
    }
  };

  const Observer = typeof MutationObserver === 'function' ? MutationObserver : null;
  const doc = getDocument();
  if (Observer && doc?.documentElement) {
    const observer = new Observer(scheduleUpdate);
    observer.observe(doc.documentElement, { childList: true, subtree: true, characterData: true });
  }

  scheduleUpdate();
  updateState();
}

const winRef = getWindow();
const shouldAutoBind = !(winRef && winRef.__TK_PDF_SKIP_AUTO_BIND__);

const docRef = getDocument();
if (docRef && shouldAutoBind) {
  if (typeof docRef.addEventListener === 'function') {
    if (docRef.readyState === 'loading') {
      docRef.addEventListener('DOMContentLoaded', bindPdfButton, { once: true });
    } else {
      bindPdfButton();
    }
  } else if (docRef.readyState === 'complete') {
    bindPdfButton();
  }
}

if (winRef) {
  winRef.downloadCompatibilityPDF = downloadCompatibilityPDF;
}

export default downloadCompatibilityPDF;
