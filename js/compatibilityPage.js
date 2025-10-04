'use strict';

(function () {
  window._tkLoaded = window._tkLoaded || { A: false, B: false };

  const state = {
    surveyA: null,
    surveyB: null,
  };

  function tkParseSurvey(raw, sideLabel) {
    try {
      const json = JSON.parse(typeof raw === 'string' ? raw : String(raw || ''));
      const answers =
        (json && (json.answers || json.data || json.rows || json.responses || [])) || [];
      if (!Array.isArray(answers) || answers.length === 0) {
        throw new Error('No answers array found');
      }
      return json;
    } catch (err) {
      alert(`Invalid JSON for Survey ${sideLabel}. Please upload the unmodified JSON file exported from this site.`);
      console.error(`[compat] parse error (${sideLabel})`, err);
      if (sideLabel === 'A') window._tkLoaded.A = false;
      if (sideLabel === 'B') window._tkLoaded.B = false;
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
    const a = state.surveyA?.answers || {};
    const b = state.surveyB?.answers || {};
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

  function maybeUpdateComparison() {
    const aCount = Object.keys(state.surveyA?.answers || {}).length;
    const bCount = Object.keys(state.surveyB?.answers || {}).length;
    if (!aCount && !bCount) {
      console.info('[compat] comparison skipped (no data)');
      return;
    }
    updateComparison();
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
    window.tkState[which] = window.tkState[which] || {};
    window.tkState[which].cells = Object.keys(answers);
  }

  function attachUpload(input, which) {
    if (!input) return;
    const onChange = (event) => {
      const file = event.target.files && event.target.files[0];
      if (!file) {
        event.target.value = '';
        attachUpload(input, which);
        return;
      }
      if (window._tkLoaded[which]) {
        console.info(`[compat] ${which} already loaded – ignoring`);
        event.target.value = '';
        attachUpload(input, which);
        return;
      }
      window._tkLoaded[which] = true;
      const reader = new FileReader();
      reader.addEventListener('error', () => {
        console.error(`[compat] file read error (${which})`, reader.error);
        window._tkLoaded[which] = false;
        event.target.value = '';
        attachUpload(input, which);
      }, { once: true });
      reader.addEventListener('load', (ev) => {
        try {
          const json = tkParseSurvey(ev.target?.result, which);
          if (!json) return;
          const parsed = parseSurvey(json);
          cacheSurvey(which, parsed);
          console.info(`[compat] stored Survey ${which} with`, Object.keys(parsed.answers).length, 'answers');
          tkDefer(() => maybeUpdateComparison());
        } catch (err) {
          console.error('[compat] normalize failed:', err);
          alert(`Invalid JSON for Survey ${which}. Please upload the unmodified JSON file exported from this site.`);
        } finally {
          window._tkLoaded[which] = false;
          event.target.value = '';
          attachUpload(input, which);
        }
      }, { once: true });
      reader.readAsText(file);
    };
    input.addEventListener('change', onChange, { passive: true, once: true });
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

  attachUpload(inputA, 'A');
  attachUpload(inputB, 'B');

  maybeUpdateComparison();
})();
