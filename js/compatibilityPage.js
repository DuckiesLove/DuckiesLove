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

/**********************************************************************
 * TALK KINK – “freeze after first upload” hard-guard (drop-in patch)
 * Paste this whole block near the end of compatibilityPage.js (or the
 * main page JS) after your functions are defined. No dev tools needed.
 **********************************************************************/

/* ------------------------------------------------------------------ */
/* 0) Shared state (kept super simple)                                */
/* ------------------------------------------------------------------ */
window.tkState  = window.tkState  || { A:null, B:null };
window._tkReady = window._tkReady || { A:false, B:false };
const bothReady = () =>
  !!(window.tkState?.A?.cells?.length && window.tkState?.B?.cells?.length);

/* ------------------------------------------------------------------ */
/* 1) Wrap ALL heavy functions so they do nothing until both ready    */
/* ------------------------------------------------------------------ */
(function wrapHeavy() {
  const heavyFns = [
    'updateComparison',       // main heavy renderer
    'calculateCompatibility', // any precompute
    'computeMatchMatrix',     // matrix calc (if present)
    'buildRows',              // row building/sorting
    'preparePercentBars',     // percent / graphics
    'bindPdf', 'exportPDF'    // PDF wiring / export
  ];

  heavyFns.forEach((fnName) => {
    if (typeof window[fnName] !== 'function') return;
    const original = window[fnName];
    if (original._tkWrapped) return;

    window[fnName] = function guarded(...args) {
      if (!bothReady()) {
        console.debug(`[compat] skipped ${fnName} (waiting for both uploads)`);
        return null;
      }
      return original.apply(this, args);
    };
    window[fnName]._tkWrapped = true;
  });

  // Suppress any “kick heavy render on load” helpers
  ['onLoadKick', 'initialRender', 'bootStrapB', 'legacyBBootstrap'].forEach((fnName) => {
    if (typeof window[fnName] === 'function') {
      const original = window[fnName];
      window[fnName] = function guardedKick(...args) {
        if (!bothReady()) {
          console.debug(`[compat] suppressed ${fnName} (both not ready)`);
          return null;
        }
        return original.apply(this, args);
      };
    }
  });

  console.info('[compat] hard-guard installed');
})();

/* ------------------------------------------------------------------ */
/* 2) Ultra-light A-only / B-only renderer to keep UI responsive      */
/* ------------------------------------------------------------------ */
function renderPartnerOnly(which) {
  try {
    const cells = (which === 'A' ? window.tkState?.A?.cells : window.tkState?.B?.cells) || [];
    const container =
      document.querySelector('#compatTable tbody') ||
      document.querySelector('#compatTable') ||
      document.getElementById('compatTable') ||
      document.querySelector('#tk-compat-body') ||
      document.body;

    const isTbody = container && container.nodeName === 'TBODY';
    while (container.firstChild) container.removeChild(container.firstChild);

    if (isTbody) {
      const messageRow = document.createElement('tr');
      const messageCell = document.createElement('td');
      messageCell.colSpan = 4;
      messageCell.style.padding = '12px 16px';
      messageCell.style.textAlign = 'left';
      messageCell.textContent = which === 'A'
        ? 'Waiting for Partner B upload… showing A only'
        : 'Waiting for Partner A upload… showing B only';
      messageRow.appendChild(messageCell);
      container.appendChild(messageRow);

      const listRow = document.createElement('tr');
      const listCell = document.createElement('td');
      listCell.colSpan = 4;
      const list = document.createElement('ul');
      list.style.cssText = 'margin:8px 0 0;padding-left:1.2rem;max-height:240px;overflow:auto';
      cells.slice(0, 50).forEach((c) => {
        const li = document.createElement('li');
        li.textContent = (c && (c.label || c.name || c.id || '—'));
        list.appendChild(li);
      });
      listCell.appendChild(list);
      listRow.appendChild(listCell);
      container.appendChild(listRow);
    } else {
      const frag = document.createDocumentFragment();
      const note = document.createElement('div');
      note.textContent = which === 'A'
        ? 'Waiting for Partner B upload… showing A only'
        : 'Waiting for Partner A upload… showing B only';
      note.style.cssText = 'margin:12px 0;font-size:14px;opacity:.9';
      frag.appendChild(note);

      const list = document.createElement('ul');
      list.style.cssText = 'margin:0;padding-left:1.2rem;max-height:240px;overflow:auto';
      cells.slice(0, 50).forEach((c) => {
        const li = document.createElement('li');
        li.textContent = (c && (c.label || c.name || c.id || '—'));
        list.appendChild(li);
      });
      frag.appendChild(list);

      container.appendChild(frag);
    }
  } catch (e) {
    console.warn('[compat] renderPartnerOnly failed', e);
  }
}

/* ------------------------------------------------------------------ */
/* 3) Single entry that runs heavy update ONLY when both are ready    */
/* ------------------------------------------------------------------ */
const tkDefer = (cb) =>
  (window.requestIdleCallback
    ? requestIdleCallback(cb, { timeout: 600 })
    : setTimeout(cb, 0));

function maybeUpdateComparison() {
  // Disable export until both sides present
  const pdfBtn =
    document.querySelector('#downloadPdfBtn') ||
    document.querySelector('#downloadBtn') ||
    document.querySelector('#downloadPdf');
  if (pdfBtn) pdfBtn.disabled = !bothReady();

  if (!bothReady()) {
    if (window.tkState?.A?.cells?.length) renderPartnerOnly('A');
    else if (window.tkState?.B?.cells?.length) renderPartnerOnly('B');
    return;
  }

  tkDefer(() => {
    if (typeof window.updateComparison === 'function') window.updateComparison();
  });
}

/* ------------------------------------------------------------------ */
/* 4) Upload wiring (A/B) – lightweight parse + store + guarded run   */
/*     If you already have processSurveyA/B, we’ll use those.         */
/*     Otherwise we provide tiny stubs that only fill tkState.*.      */
/* ------------------------------------------------------------------ */

// Minimal “normalize” if your site doesn’t provide one
function _tkNormalize(json) {
  const answers = Array.isArray(json?.answers)
    ? json.answers
    : (json && typeof json === 'object' && json.answers && typeof json.answers === 'object'
        ? Object.entries(json.answers).map(([key, value]) => ({ id: key, label: key, value }))
        : []);
  // turn answers into simple "cells" with label/id
  return answers.map((a, i) => ({
    id: a?.id ?? a?.key ?? a?.code ?? `ans_${i}`,
    label: a?.label ?? a?.name ?? a?.question ?? a?.id ?? `Item ${i+1}`
  }));
}

// Stub processors if not defined in your app:
if (typeof window.processSurveyA !== 'function') {
  window.processSurveyA = function (json) {
    window.tkState.A = { cells: _tkNormalize(json) };
  };
}
if (typeof window.processSurveyB !== 'function') {
  window.processSurveyB = function (json) {
    window.tkState.B = { cells: _tkNormalize(json) };
  };
}

(function wireUploads() {
  const findUpload = (which) => {
    const selectors = which === 'A'
      ? [
          'input#uploadA',
          'input#uploadSurveyA',
          'input[data-upload-a]',
          'input[data-upload="a"]',
        ]
      : [
          'input#uploadB',
          'input#uploadSurveyB',
          'input[data-upload-b]',
          'input[data-upload="b"]',
        ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && el.tagName === 'INPUT' && el.type === 'file') return el;
    }
    return null;
  };

  const safeAttr = (value) => {
    if (typeof value !== 'string' || !value) return '';
    if (window.CSS && typeof window.CSS.escape === 'function') {
      return CSS.escape(value);
    }
    return value.replace(/"/g, '\\"');
  };

  const collectTriggers = (input, which) => {
    const triggers = new Set();
    if (!(input instanceof HTMLElement)) return triggers;
    const selectors = [];
    const id = input.id && input.id.trim();
    if (id) selectors.push(`[data-upload-trigger="${safeAttr(id)}"]`);
    if (which) selectors.push(`[data-upload-trigger="${safeAttr(which)}"]`);

    const qsa = (sel) => {
      if (!sel) return [];
      try {
        return Array.from(document.querySelectorAll(sel));
      } catch (err) {
        console.warn('[compat] invalid upload trigger selector', sel, err);
        return [];
      }
    };

    selectors.forEach((sel) => qsa(sel).forEach((el) => {
      if (el instanceof HTMLElement) triggers.add(el);
    }));

    const wrapper = input.closest('.upload-button, [data-upload-wrapper]');
    if (wrapper) {
      wrapper.querySelectorAll('[data-upload-trigger], .upload-trigger').forEach((el) => {
        if (el instanceof HTMLElement) triggers.add(el);
      });
    }

    return triggers;
  };

  const activatePicker = (input) => {
    if (!(input instanceof HTMLInputElement) || input.type !== 'file') return;
    try {
      if (typeof input.showPicker === 'function') {
        input.showPicker();
        return;
      }
    } catch (err) {
      console.warn('[compat] showPicker failed, falling back to click()', err);
    }
    input.click();
  };

  const bindUploadTriggers = (input, which) => {
    if (!(input instanceof HTMLInputElement)) return;
    collectTriggers(input, which).forEach((trigger) => {
      if (trigger.dataset.tkUploadBound) return;

      const isLabel = trigger.tagName === 'LABEL' && (!trigger.htmlFor || trigger.htmlFor === input.id);

      if (!isLabel) {
        trigger.addEventListener('click', (event) => {
          try {
            if (trigger.matches(':disabled,[aria-disabled="true"]')) return;
          } catch {}
          event.preventDefault();
          activatePicker(input);
        });
      }

      trigger.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        activatePicker(input);
      });

      trigger.dataset.tkUploadBound = '1';
    });
  };

  const upA = findUpload('A');
  const upB = findUpload('B');

  if (!upA || !upB) {
    console.warn('[compat] upload inputs not found (looked for #uploadA/#uploadSurveyA and #uploadB/#uploadSurveyB)');
    return;
  }

  upA.setAttribute('accept', 'application/json');
  upB.setAttribute('accept', 'application/json');

  bindUploadTriggers(upA, 'A');
  bindUploadTriggers(upB, 'B');

  const parse = (txt, side) => {
    try {
      const json = JSON.parse(txt);
      if (!json || typeof json !== 'object') {
        throw new Error('missing answers');
      }
      return json;
    } catch {
      alert(`Invalid JSON for Survey ${side}. Please upload the original file exported from this site.`);
      return null;
    }
  };

  upA.addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = (ev) => {
      const json = parse(ev.target.result, 'A');
      if (!json) return (e.target.value = '');
      const processed = window.processSurveyA(json);
      if (!processed) {
        window._tkReady.A = false;
        e.target.value = '';
        return;
      }
      const aCount = processed?.answers
        ? Object.keys(processed.answers).length
        : Array.isArray(json.answers)
          ? json.answers.length
          : json.answers && typeof json.answers === 'object'
            ? Object.keys(json.answers).length
            : 0;
      console.info('[compat] stored Survey A with', aCount, 'answers');
      console.info('[compat] filled Partner A cells:',
        window.tkState?.A?.cells?.length || 0, '; Partner B cells:',
        window.tkState?.B?.cells?.length || 0);
      window._tkReady.A = true;
      e.target.value = ''; // allow same-file reupload
      maybeUpdateComparison();
    };
    r.readAsText(f);
  }, { passive:true });

  upB.addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = (ev) => {
      const json = parse(ev.target.result, 'B');
      if (!json) return (e.target.value = '');
      const processed = window.processSurveyB(json);
      if (!processed) {
        window._tkReady.B = false;
        e.target.value = '';
        return;
      }
      const bCount = processed?.answers
        ? Object.keys(processed.answers).length
        : Array.isArray(json.answers)
          ? json.answers.length
          : json.answers && typeof json.answers === 'object'
            ? Object.keys(json.answers).length
            : 0;
      console.info('[compat] stored Survey B with', bCount, 'answers');
      console.info('[compat] filled Partner A cells:',
        window.tkState?.A?.cells?.length || 0, '; Partner B cells:',
        window.tkState?.B?.cells?.length || 0);
      window._tkReady.B = true;
      e.target.value = '';
      maybeUpdateComparison();
    };
    r.readAsText(f);
  }, { passive:true });
})();

/* ------------------------------------------------------------------ */
/* 5) On page load, ensure heavy work can’t run until both are ready  */
/* ------------------------------------------------------------------ */
window.addEventListener('load', () => {
  console.info('[compat] page loaded – heavy work requires both uploads');
  // If anything queued a render, route it through the guard:
  maybeUpdateComparison();
});
