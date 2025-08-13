/**
 * Kink Compatibility — FULL wiring + Page-safe Multi-Page PDF (with Flag column)
 *
 * ==== EXACT SETUP STEPS (Codex do these in order) ======================================
 * 1) Create /js/pdfDownload.js and paste THIS ENTIRE FILE into it.
 *
 * 2) In compatibility.html <head> (BEFORE any script that imports this file) add:
 *    <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
 *    <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
 *
 * 3) Make sure the whole survey (ALL categories) is inside ONE container:
 *    <div id="pdf-container">
 *      <!-- your compatibility table with THEAD/TBODY lives here -->
 *    </div>
 *
 * 4) Inputs + button in the page (ids must match or update IDS below):
 *    <input id="uploadSurveyA" type="file" accept="application/json">
 *    <input id="uploadSurveyB" type="file" accept="application/json"> <!-- optional -->
 *    <button id="downloadBtn">Download PDF</button>
 *
 * 5) At the end of compatibility.html (just before </body>) import the module:
 *    <script type="module">
 *      import { downloadCompatibilityPDF } from '/js/pdfDownload.js';
 *      window.downloadCompatibilityPDF = downloadCompatibilityPDF; // optional convenience
 *    </script>
 *
 * 6) Flow to populate Column A and export:
 *    - Click “Upload Your Survey” (Partner A). We read/normalize JSON → window.surveyA
 *      and call your existing updateComparison() so the table shows Partner A in Column A.
 *    - (Optional) Upload Partner B; updateComparison() will redraw with both partners.
 *    - Click “Download PDF”. This script:
 *        • clones #compat-container (web stays untouched)
 *        • ensures 5 columns: Category | Partner A | Match | Flag | Partner B
 *        • fills Flag:  ⭐ when Match ≥ 90; 🚩 when Match ≤ 50 OR (A is 4/5 while B is empty) OR vice-versa
 *        • spaces categories (no title cut) + keeps table rows intact across pages
 *        • renders a multi-page, true-black PDF without seams
 */

import { normalizeKey } from './compatNormalizeKey.js';

/* ================================ CONFIG ================================== */
const IDS = {
  uploadA: '#uploadSurveyA, [data-upload-a]',
  uploadB: '#uploadSurveyB, [data-upload-b]',
  downloadBtn: '#downloadBtn',
  container: '#compat-container'
};
const PDF_ORIENTATION = 'landscape';  // 'portrait' | 'landscape'
const STAR_MIN = 90;                   // ⭐ threshold (Match %)
const RED_FLAG_MAX = 50;               // 🚩 threshold (Match %)
const CATEGORY_MIN_TOP = 64;           // min space above a category when starting near bottom
const ROW_TOP_PAD = 20;                // space inserted to avoid row split
const LABEL_LEFT_ALIGN = true;         // left-align category headers in PDF

const PARTNER_A_CELL_SEL = 'td.pa';
const CATEGORY_CELL_SEL = 'td:first-child';

/* ============================== LIB CHECK ================================= */
function getJsPDF() {
  return (window.jspdf && window.jspdf.jsPDF) || (window.jsPDF && window.jsPDF.jsPDF);
}
function assertLibs() {
  if (!window.html2canvas) throw new Error('html2canvas missing');
  if (!getJsPDF()) throw new Error('jsPDF missing');
}

/* ========================= DATA & UPDATE LOGIC =========================== */
if (typeof window !== 'undefined') {
  window.partnerAData = window.partnerAData || null;
  window.partnerBData = window.partnerBData || null;
}

function normalizeSurvey(json) {
  const items = [];
  const toNum = v => (typeof v === 'number' ? v : Number(v ?? 0));

  const walk = obj => {
    if (!obj) return;
    if (Array.isArray(obj)) { obj.forEach(walk); return; }
    if (typeof obj !== 'object') return;

    if (Array.isArray(obj.items)) { obj.items.forEach(walk); return; }

    const hasKey = obj.key || obj.id || obj.name || obj.label;
    const hasRating = obj.rating ?? obj.score ?? obj.value;
    if (hasKey && hasRating !== undefined) {
      items.push({
        key: obj.key ?? obj.id ?? obj.name ?? obj.label,
        rating: toNum(obj.rating ?? obj.score ?? obj.value)
      });
      return;
    }

    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === 'number' || typeof v === 'string') {
        items.push({ key: k, rating: toNum(v) });
      } else if (v && typeof v === 'object') {
        if ('rating' in v || 'score' in v || 'value' in v) {
          items.push({ key: k, rating: toNum(v.rating ?? v.score ?? v.value) });
        } else {
          walk(v);
        }
      }
    }
  };

  if (json && typeof json === 'object') walk(json);
  return { items };
}

function surveyToLookup(survey) {
  const out = {};
  if (!survey || !Array.isArray(survey.items)) return out;
  survey.items.forEach(it => {
    const key = normalizeKey(it.key ?? it.id ?? it.label ?? it.name);
    if (key) out[key] = Number(it.rating ?? it.score ?? it.value ?? 0);
  });
  return out;
}

window.updateComparison = function updateComparison() {
  const root = document.querySelector('[data-compat-root]') || document.querySelector('#pdf-container');
  if (!root) return;
  const lookupA = surveyToLookup(window.partnerAData);
  const lookupB = surveyToLookup(window.partnerBData);

  const findVal = (lookup, key) => {
    if (key in lookup) return lookup[key];
    for (const [k, v] of Object.entries(lookup)) {
      if (k.includes(key) || key.includes(k)) return v;
    }
  };

  let countA = 0, countB = 0;
  root.querySelectorAll('tbody > tr').forEach(tr => {
    const key = normalizeKey(
      tr.getAttribute('data-key') ||
      tr.getAttribute('data-id') ||
      tr.getAttribute('data-full') ||
      tr.querySelector('td')?.textContent || ''
    );
    if (!key) return;
    const tdA = tr.querySelector('td.pa');
    const tdB = tr.querySelector('td.pb');
    const valA = findVal(lookupA, key);
    if (tdA && valA !== undefined) {
      tdA.textContent = String(valA);
      countA++;
    }
    const valB = findVal(lookupB, key);
    if (tdB && valB !== undefined) {
      tdB.textContent = String(valB);
      countB++;
    }
  });
  console.log(`[compat] filled Partner A cells: ${countA}; Partner B cells: ${countB}`);
};

async function handleUploadA(e) {
  const file = e?.target?.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    window.partnerAData = normalizeSurvey(parsed);
    window.updateComparison();
  } catch (err) {
    console.error('[compat] Failed to load Partner A:', err);
    alert('Could not read Partner A JSON. Check format and try again.');
  }
}

async function handleUploadB(e) {
  const file = e?.target?.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    window.partnerBData = normalizeSurvey(parsed);
    window.updateComparison();
  } catch (err) {
    console.error('[compat] Failed to load Partner B:', err);
    alert('Could not read Partner B JSON. Check format and try again.');
  }
}

function wireUploads() {
  const inA = document.querySelector(IDS.uploadA);
  const inB = document.querySelector(IDS.uploadB);
  if (inA) inA.addEventListener('change', handleUploadA);
  if (inB) inB.addEventListener('change', handleUploadB);
}

/* ========================== TABLE SANITY/HELPERS ========================== */
const wait = ms => new Promise(r => setTimeout(r, ms));

function findPartnerAIndexByHeader(table){
  const tr = table.querySelector('thead tr'); if(!tr) return -1;
  return [...tr.children].findIndex(th => normalizeKey(th.textContent) === 'partner a');
}

function partnerAHasData(){
  const tables = document.querySelectorAll(`${IDS.container} table`);
  for (const table of tables) {
    if (PARTNER_A_CELL_SEL){
      const has = Array.from(table.querySelectorAll(PARTNER_A_CELL_SEL)).some(td=>{
        const t=(td.textContent||'').trim();
        return t!=='' && !/^[-–]$/.test(t);
      });
      if (has) return true;
    } else {
      const idx = findPartnerAIndexByHeader(table);
      if (idx>=0){
        const has = Array.from(table.querySelectorAll(`tbody tr td:nth-child(${idx+1})`)).some(td=>{
          const t=(td.textContent||'').trim();
          return t!=='' && !/^[-–]$/.test(t);
        });
        if (has) return true;
      }
    }
  }
  return false;
}

/* ======================= PDF-ONLY DOM TRANSFORMS ========================== */
/* 0) CSS for clone: black bg, no row splitting, black spacers */
(function injectPdfBreakCSS(){
  if (document.querySelector('style[data-pdf-breaks]')) return;
  const css = `
    .pdf-export, .pdf-export * { background-color: transparent !important; }
    .pdf-export { background:#000 !important; color:#fff !important; padding:18px !important; }
    .pdf-export table{ border-collapse: collapse !important; table-layout: fixed !important; width: 100% !important; }
    .pdf-export thead, .pdf-export tbody, .pdf-export tr { break-inside: avoid !important; page-break-inside: avoid !important; }
    .pdf-export .pdf-soft-break { width:100%!important; height:24px!important; background:#000!important; margin:0!important; padding:0!important; border:0!important }
    /* final 5-col layout: Category | Partner A | Match | Flag | Partner B */
    .pdf-export tr>*:nth-child(1){width:56%!important;text-align:left!important;white-space:normal!important;word-break:break-word!important}
    .pdf-export tr>*:nth-child(2){width:12%!important;text-align:center!important;white-space:nowrap!important}
    .pdf-export tr>*:nth-child(3){width:12%!important;text-align:center!important;white-space:nowrap!important}
    .pdf-export tr>*:nth-child(4){width:6%!important; text-align:center!important; white-space:nowrap!important}
    .pdf-export tr>*:nth-child(5){width:12%!important;text-align:center!important;white-space:nowrap!important}
  `;
  const s=document.createElement('style'); s.setAttribute('data-pdf-breaks','true'); s.textContent=css; document.head.appendChild(s);
})();

/* 1) Build safe clone (web page remains untouched) */
function makeClone(){
  const src = document.querySelector(IDS.container);
  if (!src) throw new Error('#compat-container not found');

  const shell = document.createElement('div');
  Object.assign(shell.style,{background:'#000',color:'#fff',margin:0,padding:0,width:'100%',minHeight:'100vh',overflow:'auto'});

  const clone = src.cloneNode(true);
  clone.classList.add('pdf-export');

  // strip UI elements
  clone.querySelectorAll('[data-hide-in-pdf], .download-btn, .print-btn, nav, header, footer').forEach(e=>e.remove());

  // force table layout for html2canvas
  clone.querySelectorAll('table').forEach(e=>e.style.display='table');
  clone.querySelectorAll('thead').forEach(e=>e.style.display='table-header-group');
  clone.querySelectorAll('tbody').forEach(e=>e.style.display='table-row-group');
  clone.querySelectorAll('tr').forEach(e=>e.style.display='table-row');
  clone.querySelectorAll('td,th').forEach(e=>e.style.display='table-cell');

  // left-align category headers/titles if asked
  if (LABEL_LEFT_ALIGN) {
    clone.querySelectorAll('.compat-category,.section-title,h2,h3').forEach(n=>n.style.textAlign='left');
  }

  document.body.appendChild(shell);
  shell.appendChild(clone);
  return { shell, clone };
}

/* 2) Guarantee 5-column order and create the Flag column if missing; populate ⭐/🚩 */
function ensureFlagColumnAndPopulate(root){
  root.querySelectorAll('table').forEach(table=>{
    const head=table.querySelector('thead tr'); if(!head) return;
    const hdrs=[...head.children].map(th=>(th.textContent||'').trim().toLowerCase());
    let idxA = hdrs.findIndex(h=>/partner\s*a/.test(h));
    let idxM = hdrs.findIndex(h=>/\bmatch\b/.test(h));
    let idxB = hdrs.findIndex(h=>/partner\s*b/.test(h));

    // Insert Flag header after Match (even if a previous Flag exists in a different spot)
    // First: remove any existing "flag" header to avoid duplicates
    const idxFlagExisting = hdrs.findIndex(h=>/^flag(\/\s*star)?$/.test(h));
    if (idxFlagExisting>-1){ head.children[idxFlagExisting].remove(); table.querySelectorAll('tbody tr').forEach(tr=>tr.children[idxFlagExisting]?.remove()); }

    // Recompute hdrs and indices after potential removal
    const hdrs2=[...head.children].map(th=>(th.textContent||'').trim().toLowerCase());
    idxA = hdrs2.findIndex(h=>/partner\s*a/.test(h));
    idxM = hdrs2.findIndex(h=>/\bmatch\b/.test(h));
    idxB = hdrs2.findIndex(h=>/partner\s*b/.test(h));

    // Insert new Flag header
    const th = document.createElement('th'); th.textContent = 'Flag';
    head.insertBefore(th, head.children[idxM+1] || null);

    // Insert flag cell per row
    table.querySelectorAll('tbody tr').forEach(tr=>{
      const td = document.createElement('td'); td.className = 'flag-cell'; td.textContent = '';
      tr.insertBefore(td, tr.children[idxM+1] || null);
    });

    // Populate flag symbols per row
    table.querySelectorAll('tbody tr').forEach(tr=>{
      const getNum = td => {
        const t = (td?.textContent||'').trim();
        if (t==='' || t==='-' || t==='–') return null;
        const n = Number(t.replace('%',''));
        return Number.isFinite(n) ? n : null;
      };
      const pctMatch = getNum(tr.children[idxM]);           // expects Match cell like "87"
      const aVal = getNum(tr.children[idxA]);               // expects 0–5 (or "-")
      const bVal = getNum(tr.children[idxB]);
      const flagCell = tr.children[idxM+1];

      let icon = '';
      if (pctMatch!=null && pctMatch >= STAR_MIN) icon = '⭐';

      const high = v => v!=null && v>=4;
      const noAns = v => v==null;
      if ((pctMatch!=null && pctMatch <= RED_FLAG_MAX) ||
          (high(aVal) && noAns(bVal)) ||
          (high(bVal) && noAns(aVal))) {
        icon = '🚩';
      }
      flagCell.textContent = icon;
    });
  });
}

/* ===================== PAGE-SAFE MULTI-PAGE RENDERER ====================== */
function computePageHeightCss({ clone, pdfWidthPt, pdfHeightPt }) {
  const cssWidth = Math.ceil(Math.max(
    clone.scrollWidth,
    clone.getBoundingClientRect().width,
    document.documentElement.clientWidth
  ));
  // -1 to prevent hairline seam from rounding
  const pageHeightCss = Math.max(1, Math.floor(cssWidth * (pdfHeightPt / pdfWidthPt)) - 1);
  return { cssWidth, pageHeightCss };
}

function keepCategoriesIntact(clone, pageHeightCss, minTopSpace = CATEGORY_MIN_TOP, topPad = 24) {
  const baseTop = clone.getBoundingClientRect().top;
  const sections = [...clone.querySelectorAll('.compat-section')];
  const headings = [...clone.querySelectorAll('.section-title, .category-header, .compat-category, h2, h3')];
  const blocks = sections.length ? sections : headings;
  let pageEnd = pageHeightCss, guard = 6;

  for (const el of blocks) {
    const r = el.getBoundingClientRect(); const top = r.top - baseTop; const bottom = top + r.height;
    if (bottom > pageEnd - guard || (pageEnd - top) < minTopSpace) {
      const spacer = document.createElement('div'); spacer.className='pdf-soft-break';
      spacer.style.height = `${Math.max(0, Math.ceil((pageEnd - top) + topPad))}px`;
      el.parentNode.insertBefore(spacer, el); pageEnd += pageHeightCss;
    }
  }
}

function keepRowsIntact(clone, pageHeightCss, topPad = ROW_TOP_PAD) {
  const baseTop = clone.getBoundingClientRect().top;
  const rows = [...clone.querySelectorAll('table tbody tr')];
  let pageEnd = pageHeightCss, guard = 6;
  for (const tr of rows) {
    const r = tr.getBoundingClientRect(); const top = r.top - baseTop; const bottom = top + r.height;
    if (bottom > pageEnd - guard) {
      const spacer = document.createElement('div'); spacer.className='pdf-soft-break';
      spacer.style.height = `${Math.max(0, Math.ceil((pageEnd - top) + topPad))}px`;
      tr.parentNode.insertBefore(spacer, tr); pageEnd += pageHeightCss;
    } else if ((pageEnd - top) < (r.height + guard)) {
      const spacer = document.createElement('div'); spacer.className='pdf-soft-break';
      spacer.style.height = `${topPad}px`; tr.parentNode.insertBefore(spacer, tr); pageEnd += pageHeightCss;
    }
  }
}

async function renderMultiPagePDF({ clone, jsPDFCtor, orientation=PDF_ORIENTATION, jpgQuality=0.95 }) {
  const pdf = new jsPDFCtor({ unit:'pt', format:'letter', orientation });
  const pdfW = pdf.internal.pageSize.getWidth();
  const pdfH = pdf.internal.pageSize.getHeight();
  const { cssWidth, pageHeightCss } = computePageHeightCss({ clone, pdfWidthPt: pdfW, pdfHeightPt: pdfH });

  // page safety first (prevents split titles/rows)
  keepCategoriesIntact(clone, pageHeightCss, CATEGORY_MIN_TOP, 24);
  keepRowsIntact(clone, pageHeightCss, ROW_TOP_PAD);

  const totalCssHeight = Math.ceil(Math.max(clone.scrollHeight, clone.getBoundingClientRect().height));

  // pick a scale to stay under ~18MP per slice
  const MAX_MP = 18; let scale = 2;
  const estMP = (cssWidth * pageHeightCss * scale * scale) / 1e6;
  if (estMP > MAX_MP) scale = Math.max(1, Math.sqrt((MAX_MP * 1e6) / (cssWidth * pageHeightCss)));

  // slice the page-height repeatedly; each slice = one PDF page
  let y = 0, page = 0;
  while (y < totalCssHeight) {
    const sliceH = Math.min(pageHeightCss, totalCssHeight - y);
    const canvas = await html2canvas(clone, {
      backgroundColor:'#000', scale, useCORS:true, allowTaint:true,
      scrollX:0, scrollY:0, windowWidth:cssWidth, windowHeight:sliceH, height:sliceH, y
    });
    const img = canvas.toDataURL('image/jpeg', jpgQuality);
    if (page > 0) pdf.addPage();
    pdf.addImage(img, 'JPEG', 0, 0, pdfW, pdfH, undefined, 'FAST');
    page++; y += sliceH;
  }
  return pdf;
}

/* ============================== EXPORT ENTRY ============================== */
export async function downloadCompatibilityPDF() {
  try { assertLibs(); } catch (e) { console.error(e); alert(e.message); return; }

  // Guard: ensure Partner A (Column A) is populated in the live DOM
  if (!partnerAHasData()) {
    alert('Partner A (Column A) looks empty. Upload your survey JSON first.');
    return;
  }

  const { shell, clone } = makeClone();

  // Ensure 5 columns and populate Flag (⭐/🚩) in the CLONE (web stays untouched)
  ensureFlagColumnAndPopulate(clone);

  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

  try {
    const jsPDFCtor = getJsPDF();
    const pdf = await renderMultiPagePDF({ clone, jsPDFCtor, orientation: PDF_ORIENTATION, jpgQuality: 0.95 });
    pdf.save('kink-compatibility.pdf');
  } catch (err) {
    console.error('[pdf] render error:', err);
    alert('Could not generate PDF. See console for details.');
  } finally {
    // cleanup overlay shell
    const overlay = clone && clone.parentNode;
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
  }
}

/* =============================== BOOTSTRAP ================================ */
(function boot(){
  // wire uploads so Column A gets filled from Partner A JSON
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wireUploads);
  else wireUploads();

  // auto-wire the Download button
  const wireBtn = () => {
    const btn = document.querySelector(IDS.downloadBtn);
    if (!btn) { console.warn('[pdf] #downloadBtn not found.'); return; }
    const fresh = btn.cloneNode(true); btn.replaceWith(fresh);
    fresh.addEventListener('click', async () => {
      if (!partnerAHasData()) {
        alert('Partner A looks empty. Upload your survey and wait for the table to refresh.');
        return;
      }
      await downloadCompatibilityPDF();
    });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wireBtn);
  else wireBtn();
})();

// convenience global
if (typeof window !== 'undefined') window.downloadCompatibilityPDF = downloadCompatibilityPDF;

