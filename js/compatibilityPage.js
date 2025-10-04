'use strict';

(function () {
  window.tkState = window.tkState || { A: null, B: null };
  window._tkReady = window._tkReady || { A: false, B: false };
  window._tkLoaded = window._tkLoaded || { A: false, B: false };

  const bothReady = () =>
    !!(window.tkState?.A?.cells?.length && window.tkState?.B?.cells?.length);

  (function wrapHeavy() {
    const names = [
      'updateComparison',
      'calculateCompatibility',
      'computeMatchMatrix',
      'buildRows',
      'preparePercentBars',
      'bindPdf',
      'exportPDF',
    ];

    names.forEach((fnName) => {
      const original = window[fnName];
      if (typeof original !== 'function' || original._tkWrapped) return;
      window[fnName] = function guarded(...args) {
        if (!bothReady()) {
          console.debug(`[compat] skipped ${fnName} (waiting for both uploads)`);
          return null;
        }
        return original.apply(this, args);
      };
      window[fnName]._tkWrapped = true;
    });

    const kickers = ['onLoadKick', 'initialRender', 'bootStrapB', 'legacyBBootstrap'];
    kickers.forEach((fnName) => {
      const original = window[fnName];
      if (typeof original !== 'function') return;
      window[fnName] = function guardedKicker(...args) {
        if (!bothReady()) {
          console.debug(`[compat] suppressed ${fnName} (both not ready)`);
          return null;
        }
        return original.apply(this, args);
      };
    });

    console.info('[compat] hard-guard installed');
  })();

  const state = {
    surveyA: null,
    surveyB: null,
  };

  function tkParseSurvey(raw, sideLabel) {
    try {
      const json =
        typeof raw === 'object' && raw !== null
          ? raw
          : JSON.parse(typeof raw === 'string' ? raw : String(raw || ''));
      const answersSource =
        (json && (json.answers || json.data || json.rows || json.responses || [])) || [];
      const hasAnswers = Array.isArray(answersSource)
        ? answersSource.length > 0
        : answersSource && typeof answersSource === 'object'
          ? Object.keys(answersSource).length > 0
          : false;
      if (!hasAnswers) {
        throw new Error('No answers array found');
      }
      return json;
    } catch (err) {
      alert(`Invalid JSON for Survey ${sideLabel}. Please upload the unmodified JSON file exported from this site.`);
      console.error(`[compat] parse error (${sideLabel})`, err);
      if (sideLabel === 'A') window._tkReady.A = false;
      if (sideLabel === 'B') window._tkReady.B = false;
      return null;
    }
  }

  const tkDefer = (cb) =>
    (window.requestIdleCallback ? requestIdleCallback(cb, { timeout: 500 }) : setTimeout(cb, 0));

  const labelAPI = window.TK_LABELS || window.tkLabels || null;
  const labelsPromise = (async () => {
    if (labelAPI?.load) {
      try {
        await labelAPI.load();
      } catch (err) {
        console.warn('[compat] label load failed', err);
      }
    }
    return labelAPI;
  })();

  function parseSurvey(json) {
    if (!json || typeof json !== 'object') throw new Error('Empty/invalid survey');
    if (json.answers && typeof json.answers === 'object') {
      const answers = {};
      Object.entries(json.answers).forEach(([key, value]) => {
        if (!key) return;
        answers[key] = Number(value ?? 0);
      });
      return { answers };
    }
    if (Array.isArray(json.items)) {
      const answers = {};
      for (const it of json.items) {
        const k = it.key || it.id;
        if (k) answers[k] = Number(it.value ?? it.score ?? 0);
      }
      return { answers };
    }
    throw new Error('Unsupported survey format');
  }

  function scoreMatch(a, b) {
    if (a == null || b == null) return null;
    const ai = Number(a);
    const bi = Number(b);
    if (Number.isNaN(ai) || Number.isNaN(bi)) return null;
    return Math.max(0, 100 - (Math.abs(ai - bi) / 5) * 100);
  }

  function pctBar(percent) {
    const wrap = document.createElement('div');
    wrap.className = 'pct';
    const fill = document.createElement('div');
    fill.className = 'pct-fill';
    fill.style.width = `${Math.round(percent)}%`;
    const txt = document.createElement('div');
    txt.className = 'pct-text';
    txt.textContent = `${Math.round(percent)}%`;
    wrap.append(fill, txt);
    return wrap;
  }

  function catCell(id, labels) {
    const td = document.createElement('td');
    let label = id;
    if (labels) {
      try {
        if (typeof labels.get === 'function') {
          const lookup = labels.get(id);
          if (lookup) label = lookup;
        } else if (typeof labels.labelFor === 'function') {
          label = labels.labelFor(id) || id;
        }
      } catch (err) {
        console.warn('[compat] label lookup failed for', id, err);
      }
    }
    const span = document.createElement('span');
    span.className = 'tk-cat';
    span.textContent = label;
    const code = document.createElement('span');
    code.className = 'tk-code';
    code.textContent = `(${id})`;
    td.append(span, code);
    return td;
  }

  function renderRow(tbody, id, aVal, bVal, labels) {
    const tr = document.createElement('tr');
    tr.append(catCell(id, labels));
    const tdA = document.createElement('td');
    tdA.textContent = aVal ?? '—';
    const tdPct = document.createElement('td');
    const tdB = document.createElement('td');
    tdB.textContent = bVal ?? '—';
    const pct = scoreMatch(aVal, bVal);
    if (pct == null) {
      tdPct.textContent = '—';
    } else {
      tdPct.append(pctBar(pct));
    }
    tr.append(tdA, tdPct, tdB);
    tbody.append(tr);
  }

  async function updateComparison() {
    if (!bothReady()) {
      console.debug('[compat] skipped updateComparison (waiting for both uploads)');
      return null;
    }
    const a = state.surveyA?.answers || {};
    const b = state.surveyB?.answers || {};
    const aCount = Object.keys(a).length;
    const bCount = Object.keys(b).length;
    if (!aCount || !bCount) return;
    const allIds = Array.from(new Set([...Object.keys(a), ...Object.keys(b)])).sort();
    const labels = await labelsPromise;
    const tbody = document.querySelector('#tk-compat-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    let aCells = 0;
    let bCells = 0;
    for (const id of allIds) {
      const av = Object.prototype.hasOwnProperty.call(a, id) ? a[id] : null;
      const bv = Object.prototype.hasOwnProperty.call(b, id) ? b[id] : null;
      if (av != null) aCells++;
      if (bv != null) bCells++;
      renderRow(tbody, id, av, bv, labels);
    }
    console.info('[compat] filled Partner A cells:', aCells, '; Partner B cells:', bCells);
  }

  function cacheSurvey(which, parsed) {
    state[`survey${which}`] = parsed;
    const answers = parsed.answers || {};
    if (which === 'A') {
      window.partnerASurvey = answers;
      window.surveyA = answers;
    } else {
      window.partnerBSurvey = answers;
      window.surveyB = answers;
    }
    window.tkState = window.tkState || {};
    window.tkState[which] = {
      cells: Object.entries(answers).map(([id, value]) => ({ id, value, label: id })),
    };
  }

  function processSurvey(which, raw) {
    try {
      const json = tkParseSurvey(raw, which);
      if (!json) return null;
      const parsed = parseSurvey(json);
      cacheSurvey(which, parsed);
      console.info(
        `[compat] stored Survey ${which} with`,
        Object.keys(parsed.answers).length,
        'answers'
      );
      return parsed;
    } catch (err) {
      console.error('[compat] normalize failed:', err);
      alert(
        `Invalid JSON for Survey ${which}. Please upload the unmodified JSON file exported from this site.`
      );
      return null;
    }
  }

  window.updateComparison = updateComparison;
  window.processSurveyA = (json) => processSurvey('A', json);
  window.processSurveyB = (json) => processSurvey('B', json);
  window.tkProcessSurvey = processSurvey;
})();


/***********************************************************************
 * TALK KINK – drop-in “no-freeze + labels + % bars + A→Z categories”
 * Paste this whole block once (near the end of your page JS). It is
 * self-contained and safe even if parts already exist.
 *
 * What this does:
 *  1) Prevents the page from “freezing” after the first upload by
 *     guarding heavy work until BOTH surveys are loaded.
 *  2) Translates cb_* codes to human-readable labels (uses
 *     /data/labels-overrides.json if present, with sensible fallback).
 *  3) Adds a simple percentage bar in the “Match %” column.
 *  4) Alphabetizes category UIs (both the side “category selection”
 *     checklist and the report table) after labels are applied.
 **********************************************************************/

/* ---------------------------- 0) GLOBAL STATE ---------------------------- */
window.tkState  = window.tkState  || { A:null, B:null };
window._tkReady = window._tkReady || { A:false, B:false };

/* ------------------------ 1) UTIL / CSS INJECTION ----------------------- */
(function injectCSS(){
  if (document.getElementById('tk-addon-css')) return;
  const css = `
    .tk-bar { position:relative; height:18px; border:1px solid #888; border-radius:4px; }
    .tk-bar>i { position:absolute; inset:0; width:0%; background:#23b37a; border-radius:3px; }
    .tk-bar>span { position:absolute; inset:0; display:flex; align-items:center;
                   justify-content:center; font:600 12px/1 system-ui, sans-serif; color:#fff; }
    .tk-note { margin:.5rem 0; font-size:14px; opacity:.85 }
  `;
  const style = Object.assign(document.createElement('style'), { id:'tk-addon-css', textContent:css });
  document.head.appendChild(style);
})();

const bothReady = () => !!(window.tkState?.A?.cells?.length && window.tkState?.B?.cells?.length);

/* ------------------ 2) WRAP HEAVY FUNCS (no work until both) ------------ */
(function wrapHeavy() {
  const heavy = [
    'updateComparison',
    'calculateCompatibility',
    'computeMatchMatrix',
    'buildRows',
    'preparePercentBars',
    'bindPdf','exportPDF'
  ];
  heavy.forEach((name)=>{
    const fn = window[name];
    if (typeof fn !== 'function' || fn._tkWrapped) return;
    window[name] = function guarded(...args){
      if (!bothReady()) { console.debug(`[compat] ${name} skipped; waiting for both uploads`); return null; }
      return fn.apply(this, args);
    };
    window[name]._tkWrapped = true;
  });

  // stop any “kick on load” helpers from running early
  ['onLoadKick','initialRender','bootStrapB','legacyBBootstrap'].forEach((name)=>{
    const fn = window[name];
    if (typeof fn !== 'function') return;
    window[name] = function guardedKick(...args){
      if (!bothReady()) { console.debug(`[compat] ${name} suppressed (both not ready)`); return null; }
      return fn.apply(this, args);
    };
  });

  console.info('[tk] guards installed');
})();

/* ------------------- 3) VERY LIGHT A-ONLY / B-ONLY VIEW ------------------ */
function renderPartnerOnly(which){
  try{
    const cells = (which==='A' ? window.tkState?.A?.cells : window.tkState?.B?.cells) || [];
    const container = document.querySelector('#compatTable tbody')
                   || document.querySelector('#compatTable')
                   || document.getElementById('compatTable')
                   || document.querySelector('.compat-table')
                   || document.body;
    const frag = document.createDocumentFragment();
    const note = Object.assign(document.createElement('div'), {
      className:'tk-note',
      textContent: which==='A'
        ? 'Waiting for Partner B upload… showing A only'
        : 'Waiting for Partner A upload… showing B only'
    });
    frag.appendChild(note);
    const ul = Object.assign(document.createElement('ul'), { style:'max-height:240px;overflow:auto;padding-left:1.1rem;margin:0' });
    cells.slice(0,50).forEach(c=>{
      const li = document.createElement('li');
      li.textContent = c?.label || c?.name || c?.id || '—';
      ul.appendChild(li);
    });
    frag.appendChild(ul);
    while (container.firstChild) container.removeChild(container.firstChild);
    container.appendChild(frag);
  }catch(e){ console.warn('[tk] renderPartnerOnly failed', e); }
}

/* ------------------ 4) LABELS (codes → human-friendly) ------------------- */
const TK_LABELS_FALLBACK = {
  // Add/extend freely; file merges will override these
  cb_wwf76: 'Makeup as protocol or control',
  cb_swujj: 'Accessory or ornament rules',
  cb_05hqj: 'Wardrobe restrictions or permissions'
};

const TK_LABELS = { ...TK_LABELS_FALLBACK }; // final map

async function tkLoadLabelOverrides(){
  try{
    // optional JSON the site can host to override/extend labels
    const res = await fetch('/data/labels-overrides.json', { cache:'no-store' });
    if (!res.ok) return console.info('[tk] no label overrides present');
    const json = await res.json();
    Object.assign(TK_LABELS, json || {});
    console.info('[tk] labels overrides merged:', Object.keys(json||{}).length, 'keys');
  }catch(e){ console.info('[tk] label overrides not loaded (ok)'); }
}

function tkTranslate(text){
  if (!text || typeof text!=='string') return text;
  // exact code
  if (TK_LABELS[text]) return TK_LABELS[text];
  // tolerant: pick first token that looks like a code
  const code = (text.match(/\bcb_[a-z0-9]{4,}\b/i)||[])[0];
  return TK_LABELS[code] || text;
}

/* ----------- 5) TABLE HELPERS: apply labels + add % bars + sort ---------- */
function tkApplyLabelsToTable(){
  const rows = document.querySelectorAll('#compatTable tbody tr, table tbody tr');
  rows.forEach(tr=>{
    const tdCat = tr.querySelector('td,th');
    if (!tdCat) return;
    const txt = tdCat.textContent.trim();
    const pretty = tkTranslate(txt);
    if (pretty && pretty !== txt) tdCat.textContent = pretty;
  });
}

function tkAddPercentBars(){
  const headIdx = (() => {
    const ths = Array.from(document.querySelectorAll('thead th'));
    const idx = ths.findIndex(th => /match\s*%/i.test(th.textContent));
    return idx >= 0 ? idx : 2; // safe default 3rd col
  })();

  const rows = document.querySelectorAll('#compatTable tbody tr, table tbody tr');
  rows.forEach(tr=>{
    const tds = tr.children;
    if (!tds[headIdx]) return;
    const cell = tds[headIdx];
    const raw = (cell.textContent||'').trim();
    let pct = null;
    if (/^\d+%$/.test(raw)) pct = parseInt(raw,10);
    if (raw==='—' || raw==='' || pct===null) { cell.textContent = '—'; return; }

    cell.textContent = '';
    const bar = Object.assign(document.createElement('div'), { className:'tk-bar' });
    const fill = document.createElement('i');
    fill.style.width = Math.max(0, Math.min(100, pct)) + '%';
    const label = Object.assign(document.createElement('span'), { textContent: pct + '%' });
    bar.append(fill, label);
    cell.appendChild(bar);
  });
}

function tkSortTableAZ(){
  const table = document.querySelector('#compatTable') || document.querySelector('table');
  const tbody = table?.querySelector('tbody');
  if (!tbody) return;
  const rows = Array.from(tbody.rows);
  rows.sort((a,b)=>{
    const A = (a.cells[0]?.textContent||'').trim().toLocaleLowerCase();
    const B = (b.cells[0]?.textContent||'').trim().toLocaleLowerCase();
    return A.localeCompare(B);
  });
  rows.forEach(r=>tbody.appendChild(r));
}

/* ---------------- 6) SIDEBAR CATEGORY CHECKLIST A→Z (UI) ---------------- */
function tkSortCategoryChecklistAZ(){
  // Try a few likely containers; adjust as needed for your DOM
  const panel =
    document.querySelector('[aria-label="Category selection"]') ||
    document.querySelector('#categoryPanel') ||
    document.querySelector('.tk-wide-panel') ||
    document.querySelector('aside[role="region"]');

  if (!panel) return;

  // Gather list items that contain a label or text
  const items = Array.from(panel.querySelectorAll('li, .item, .row, label')).filter(el=>{
    const t = (el.textContent||'').trim();
    return t && t.length > 0;
  });

  if (items.length < 2) return;

  // Deduplicate to the top-most element that actually reorders (UL/OL)
  const list = panel.querySelector('ul,ol') || panel;
  const unique = Array.from(new Set(items.map(el => el.closest('li') || el)));

  unique.sort((a,b)=>{
    const A = (a.textContent||'').trim().toLocaleLowerCase();
    const B = (b.textContent||'').trim().toLocaleLowerCase();
    return A.localeCompare(B);
  });

  unique.forEach(el => list.appendChild(el));
  console.info('[tk] category checklist sorted A→Z');
}

/* ------------------ 7) SAFETY ENTRYPOINT (only when both ready) ---------- */
const tkDefer = (cb) =>
  (window.requestIdleCallback ? requestIdleCallback(cb, { timeout:800 }) : setTimeout(cb,0));

function tkMaybeRender(){
  // disable export until both sides ready (if such a button exists)
  const pdfBtn = document.querySelector('#downloadPdfBtn');
  if (pdfBtn) pdfBtn.disabled = !bothReady();

  if (!bothReady()){
    if (window.tkState?.A?.cells?.length) renderPartnerOnly('A');
    else if (window.tkState?.B?.cells?.length) renderPartnerOnly('B');
    return;
  }

  tkDefer(()=>{
    if (typeof window.updateComparison === 'function') window.updateComparison();
    // Post-render enhancements:
    tkApplyLabelsToTable();
    tkAddPercentBars();
    tkSortTableAZ();
  });
}

/* ----------------------- 8) UPLOAD WIRING (failsafe) --------------------- */
/* If your app already wires these, this is harmless. It just ensures we
   parse JSON, fill tkState, and allow same-file reupload without reload. */

function _tkNormalize(json){
  const answers = Array.isArray(json?.answers) ? json.answers : [];
  return answers.map((a,i)=>({
    id: a?.id ?? a?.key ?? a?.code ?? `ans_${i}`,
    label: a?.label ?? a?.name ?? a?.question ?? a?.id ?? `Item ${i+1}`
  }));
}

if (typeof window.processSurveyA !== 'function') {
  window.processSurveyA = function (json) { window.tkState.A = { cells: _tkNormalize(json) }; };
}
if (typeof window.processSurveyB !== 'function') {
  window.processSurveyB = function (json) { window.tkState.B = { cells: _tkNormalize(json) }; };
}

(function wireUploads(){
  const upA = document.getElementById('uploadA');
  const upB = document.getElementById('uploadB');
  if (!upA || !upB) { console.warn('[tk] upload inputs not found'); return; }

  const parse = (txt, side) => {
    try{
      const json = JSON.parse(txt);
      if (!Array.isArray(json?.answers) || !json.answers.length) throw 0;
      return json;
    }catch{
      alert(`Invalid JSON for Survey ${side}. Please upload the original file exported from this site.`);
      return null;
    }
  };

  upA.addEventListener('change', (e)=>{
    const f = e.target.files?.[0]; if (!f) return;
    const r = new FileReader();
    r.onload = (ev)=>{
      const json = parse(ev.target.result, 'A'); if (!json) return (e.target.value='');
      window.processSurveyA(json);
      console.info('[tk] stored Survey A with', (json.answers||[]).length, 'answers');
      console.info('[tk] filled Partner A cells:', window.tkState?.A?.cells?.length||0, '; Partner B cells:', window.tkState?.B?.cells?.length||0);
      window._tkReady.A = true; e.target.value=''; tkMaybeRender();
    };
    r.readAsText(f);
  }, {passive:true});

  upB.addEventListener('change', (e)=>{
    const f = e.target.files?.[0]; if (!f) return;
    const r = new FileReader();
    r.onload = (ev)=>{
      const json = parse(ev.target.result, 'B'); if (!json) return (e.target.value='');
      window.processSurveyB(json);
      console.info('[tk] stored Survey B with', (json.answers||[]).length, 'answers');
      console.info('[tk] filled Partner A cells:', window.tkState?.A?.cells?.length||0, '; Partner B cells:', window.tkState?.B?.cells?.length||0);
      window._tkReady.B = true; e.target.value=''; tkMaybeRender();
    };
    r.readAsText(f);
  }, {passive:true});
})();

/* ----------------------- 9) BOOT: labels + A→Z UI ------------------------ */
window.addEventListener('load', async ()=>{
  await tkLoadLabelOverrides();     // merge labels if file exists
  tkSortCategoryChecklistAZ();      // alphabetize the category picker UI
  tkMaybeRender();                  // ensure nothing heavy runs too early
});
