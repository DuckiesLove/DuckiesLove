import { savePDF as savePdfDownload } from './talkKinkDownload.js';

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

function canUseTalkKinkDownload(){
  try {
    const doc = getDocument();
    const win = getWindow();
    if (!doc || !win) return false;
    if (typeof win.URL === 'undefined' || typeof win.URL.createObjectURL !== 'function') return false;
    if (typeof doc.createElement !== 'function') return false;
    const anchor = doc.createElement('a');
    if (!anchor || typeof anchor.click !== 'function') return false;
    anchor.remove?.();
    if (!doc.body && !doc.documentElement && !doc.head) return false;
    return true;
  } catch (_) {
    return false;
  }
}

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

function normalizeProvidedRows(rows, columns){
  if (!Array.isArray(rows)) return [];
  return rows.map(raw => {
    if (Array.isArray(raw)) {
      return raw.map(val => (val == null || val === '' ? '—' : String(val)));
    }
    if (!raw || typeof raw !== 'object') {
      return columns.map(() => '—');
    }
    return columns.map(col => {
      const key = col.dataKey;
      const hasKey = key != null && Object.prototype.hasOwnProperty.call(raw, key);
      const value = hasKey ? raw[key] : raw[col.header];
      return value == null || value === '' ? '—' : String(value);
    });
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

function toScore(value){
  if (value == null) return 0;
  if (typeof value === 'number' && Number.isFinite(value)) return clampScore(value);
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return 0;
    const num = Number(trimmed.replace(/[^\d.-]/g, ''));
    if (Number.isFinite(num)) return clampScore(num);
  }
  return 0;
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

function buildBodyFromRows(extracted, columnCount){
  return extracted.map(row => {
    if (row.type === 'header') {
      return [{
        content: row.category,
        colSpan: columnCount,
        styles: { fontStyle: 'bold', halign: 'left' },
      }];
    }
    return [row.category, row.A, row.pct, row.B].map(val => (val == null || val === '' ? '—' : String(val)));
  });
}

function getJsPDFConstructor(){
  const win = getWindow();
  if (win?.jspdf?.jsPDF) return win.jspdf.jsPDF;
  if (win?.jsPDF) return win.jsPDF;
  return null;
}

function getAutoTableExecutor(doc){
  if (doc && typeof doc.autoTable === 'function') {
    return opts => doc.autoTable(opts);
  }
  const win = getWindow();
  if (win?.jspdf?.autoTable) {
    return opts => win.jspdf.autoTable(doc, opts);
  }
  const api = win?.jspdf?.jsPDF?.API;
  if (api && typeof api.autoTable === 'function') {
    return opts => api.autoTable.call(doc, opts);
  }
  const legacyApi = win?.jsPDF?.API;
  if (legacyApi && typeof legacyApi.autoTable === 'function') {
    return opts => legacyApi.autoTable.call(doc, opts);
  }
  return null;
}

function parseOptions(args){
  if (!args.length) return {};
  if (args.length === 1 && isPlainObject(args[0])) return args[0] || {};
  const opts = isPlainObject(args[2]) ? { ...args[2] } : {};
  if (args[0] != null) opts.partnerA = args[0];
  if (args[1] != null) opts.partnerB = args[1];
  return opts;
}

export async function downloadCompatibilityPDF(...args){
  const options = parseOptions(args);
  const {
    filename = 'compatibility-report.pdf',
    orientation = 'landscape',
    format = 'a4',
    columns,
    rows,
  } = options;

  const columnDefs = normalizeColumns(columns);
  const tableHead = [columnDefs.map(col => col.header || '')];
  const columnStyles = {};
  columnDefs.forEach((col, idx) => {
    columnStyles[idx] = { halign: col.align || (idx === 0 ? 'left' : 'center') };
    if (typeof col.cellWidth === 'number') {
      columnStyles[idx].cellWidth = col.cellWidth;
    }
  });

  let body = [];
  if (Array.isArray(rows) && rows.length) {
    body = normalizeProvidedRows(rows, columnDefs);
    if (!body.length) {
      console.warn('[pdf] No data rows provided to export.');
      return;
    }
  } else {
    const table = findTable();
    if (!table) {
      console.warn('[pdf] No data rows found to export.');
      disableButtonsForNoData();
      return;
    }
    const extracted = extractRows(table);
    if (!extracted.length) {
      console.warn('[pdf] No data rows found to export.');
      disableButtonsForNoData();
      return;
    }
    body = buildBodyFromRows(extracted, columnDefs.length);
  }

  const JsPDF = getJsPDFConstructor();
  if (!JsPDF) {
    console.error('jsPDF failed to load');
    return;
  }

  const doc = new JsPDF({ orientation, unit: 'pt', format });
  const execAutoTable = getAutoTableExecutor(doc);
  if (!execAutoTable) {
    console.error('jsPDF-AutoTable plugin is required.');
    return;
  }

  const tableOptions = {
    head: tableHead,
    body,
    columnStyles,
    styles: {
      fontSize: 11,
      cellPadding: 8,
      halign: 'center',
      valign: 'middle',
    },
    headStyles: {
      fontStyle: 'bold',
    },
  };

  execAutoTable(tableOptions);

  let saved = false;
  if (canUseTalkKinkDownload()) {
    try {
      await savePdfDownload(doc, filename);
      saved = true;
    } catch (error) {
      console.error('[pdf] download helper failed, falling back to jsPDF.save()', error);
    }
  }

  if (!saved && typeof doc.save === 'function') {
    doc.save(filename);
  }
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

const docRef = getDocument();
if (docRef) {
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

const winRef = getWindow();
if (winRef) {
  winRef.downloadCompatibilityPDF = downloadCompatibilityPDF;
}

export default downloadCompatibilityPDF;
