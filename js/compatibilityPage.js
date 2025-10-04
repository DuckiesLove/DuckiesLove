'use strict';

(async function () {
  // Prevent duplicate processing if old listeners fire twice or navigation restores state
  window._tkLoaded = window._tkLoaded || { A: false, B: false };

  const state = {
    surveyA: null,
    surveyB: null,
  };

  // --- NEW: pre-load labels (non-blocking, awaited before we paint rows) ---
  const labelsPromise = window.tkLabels?.load?.() ?? Promise.resolve(new Map());

  // Accepts unmodified exports from this site: { meta, answers: { id:number }, items?:[] }
  function parseSurvey(json) {
    if (!json || (typeof json !== 'object')) throw new Error('Empty/invalid survey');
    if (json.answers && typeof json.answers === 'object') {
      const answers = {};
      Object.entries(json.answers).forEach(([key, value]) => {
        if (!key) return;
        answers[key] = Number(value ?? 0);
      });
      return { answers };
    }
    // Fallback: array of {key,value}
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

  // Compute similarity as 100 - |a-b|/5 * 100 (requires both answered)
  function scoreMatch(a, b) {
    if (a == null || b == null) return null;
    const ai = Number(a); const bi = Number(b);
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

  // Helper to make a TD for the category cell (friendly label + raw code)
  function catCell(id, map) {
    const td = document.createElement('td');
    const label = (map && map.get(id)) || id;
    const span = document.createElement('span');
    span.className = 'tk-cat';
    span.textContent = label;
    const code = document.createElement('span');
    code.className = 'tk-code';
    code.textContent = `(${id})`;
    td.append(span, code);
    return td;
  }

  // Renders one row (id, aVal, bVal)
  function renderRow(tbody, id, aVal, bVal, map) {
    const tr = document.createElement('tr');
    tr.append(catCell(id, map));
    const tdA = document.createElement('td');
    tdA.textContent = (aVal ?? '—');
    const tdPct = document.createElement('td');
    const tdB = document.createElement('td');
    tdB.textContent = (bVal ?? '—');
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
    // Guard: don’t freeze if only one partner is loaded
    const a = state.surveyA?.answers || {};
    const b = state.surveyB?.answers || {};
    const allIds = Array.from(new Set([...Object.keys(a), ...Object.keys(b)])).sort();
    // Wait for labels once before paint
    const map = await labelsPromise;
    const tbody = document.querySelector('#tk-compat-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    let aCells = 0, bCells = 0;
    for (const id of allIds) {
      const av = (id in a) ? a[id] : null;
      const bv = (id in b) ? b[id] : null;
      if (av != null) aCells++;
      if (bv != null) bCells++;
      renderRow(tbody, id, av, bv, map);
    }
    console.info('[compat] filled Partner A cells:', aCells, '; Partner B cells:', bCells);
  }

  // Robust file input handlers (A and B). Accepts .json from site export, untouched.
  async function handleUpload(file, which) {
    if (which === 'A') {
      if (window._tkLoaded.A) {
        console.info('[compat] A already loaded – ignoring');
        return;
      }
      window._tkLoaded.A = true;
    } else if (which === 'B') {
      if (window._tkLoaded.B) {
        console.info('[compat] B already loaded – ignoring');
        return;
      }
      window._tkLoaded.B = true;
    }
    const text = await file.text();
    let json;
    try { json = JSON.parse(text); }
    catch { alert(`Invalid JSON for Survey ${which}. Please upload the unmodified JSON file exported from this site.`); return; }
    try {
      const parsed = parseSurvey(json);
      state[`survey${which}`] = parsed;
      if (which === 'A') {
        window.partnerASurvey = parsed.answers;
        window.surveyA = parsed.answers;
      } else {
        window.partnerBSurvey = parsed.answers;
        window.surveyB = parsed.answers;
      }
      console.info(`[compat] stored Survey ${which} with`, Object.keys(parsed.answers).length, 'answers');
      updateComparison();
    } catch (e) {
      alert(`Invalid JSON for Survey ${which}. Please upload the unmodified JSON file exported from this site.`);
      if (which === 'A') window._tkLoaded.A = false;
      if (which === 'B') window._tkLoaded.B = false;
    }
  }

  const inputA = document.querySelector('#uploadA')
    || document.querySelector('#uploadSurveyA')
    || document.querySelector('[data-upload-a]')
    || document.querySelector('#uploadYourSurvey input[type="file"]');
  const inputB = document.querySelector('#uploadB')
    || document.querySelector('#uploadSurveyB')
    || document.querySelector('[data-upload-b]')
    || document.querySelector('#uploadPartnerSurvey input[type="file"]');

  if (inputA) inputA.setAttribute('accept', 'application/json');
  if (inputB) inputB.setAttribute('accept', 'application/json');

  if (inputA) {
    inputA.addEventListener('change', e => {
      const f = e.target.files?.[0]; if (f) handleUpload(f, 'A');
    });
  }
  if (inputB) {
    inputB.addEventListener('change', e => {
      const f = e.target.files?.[0]; if (f) handleUpload(f, 'B');
    });
  }

  // Initial paint (empty table with headers present)
  updateComparison();
})();
