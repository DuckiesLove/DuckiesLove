'use strict';

(function () {
  const ID_PREFIXES = ['cb_', 'gn_', 'sa_', 'sh_', 'bd_', 'pl_', 'ps_', 'vr_', 'vo_'];
  const GROUPS = {
    'Bodily Fluids and Functions': [],
    'Body Part Torture': [],
    'Bondage and Suspension': [],
    'Breath Play': [],
    'Psychological': [],
    'Sexual Activity': [],
    'Appearance Play': [
      'cb_zsnrb', 'cb_6jd2f', 'cb_kgrnn', 'cb_169ma', 'cb_4yyxa', 'cb_2c0f9',
      'cb_qwnhi', 'cb_zvchg', 'cb_qw9jg', 'cb_3ozhq', 'cb_hqakm', 'cb_rn136',
      'cb_wwf76', 'cb_swujj', 'cb_k55xd'
    ]
  };

  const seenIds = new Set();
  let missingBtn = null;

  document.addEventListener('DOMContentLoaded', init);
  document.addEventListener('tk-labels:ready', () => {
    if (lastState.rendered) render(lastState.rendered);
  });

  const lastState = { rendered: null };

  function init() {
    const uploadA = document.getElementById('uploadSurveyA') || document.getElementById('fileA') || document.getElementById('surveyA');
    const uploadB = document.getElementById('uploadSurveyB') || document.getElementById('fileB') || document.getElementById('surveyB');
    const tbody = document.querySelector('#compatTable tbody');
    if (!tbody) return;

    let listA = [];
    let listB = [];

    attachFileHandler(uploadA, async file => {
      listA = await parseSurveyFile(file, 'A');
      refresh();
    });
    attachFileHandler(uploadB, async file => {
      listB = await parseSurveyFile(file, 'B');
      refresh();
    });

    function refresh() {
      const rendered = buildRows(listA, listB);
      lastState.rendered = rendered;
      render(rendered);
    }
  }

  function attachFileHandler(input, onFile) {
    if (!input) return;
    input.addEventListener('change', async () => {
      const file = input.files && input.files[0];
      if (!file) return;
      try {
        await onFile(file);
      } catch (err) {
        const which = input === document.getElementById('uploadSurveyB') || input === document.getElementById('fileB') || input === document.getElementById('surveyB') ? 'B' : 'A';
        alert(`Invalid JSON for Survey ${which}. Please upload the unmodified JSON exported from this site.`);
        console.error(err);
      }
    });
  }

  async function parseSurveyFile(file, which) {
    const raw = await readJsonFile(file);
    const normalized = normalizeSurvey(raw);
    if (!Array.isArray(normalized)) {
      throw new Error(`Survey ${which} failed to normalize.`);
    }
    return normalized;
  }

  function render(rendered) {
    const table = document.querySelector('#compatTable tbody');
    if (!table) return;

    table.innerHTML = '';
    seenIds.clear();

    const labelsApi = window.tkLabels || window.TK_LABELS;
    const labelGetter = labelsApi && typeof labelsApi.getLabel === 'function'
      ? labelsApi.getLabel
      : (id) => id;

    const rowsWithLabels = rendered.rows.map(row => ({
      ...row,
      label: labelGetter(row.id)
    }));

    rowsWithLabels.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));

    rowsWithLabels.forEach(row => {
      seenIds.add(row.id);
      table.appendChild(renderRow(row));
    });

    buildUnansweredTable(rendered.mapA, rendered.mapB);
    mountMissingLabelsButton();
  }

  function readJsonFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('File read error'));
      reader.onload = () => {
        try {
          const json = JSON.parse(String(reader.result || 'null'));
          resolve(json);
        } catch (err) {
          reject(err);
        }
      };
      reader.readAsText(file);
    });
  }

  function normalizeSurvey(raw) {
    if (!raw) return [];
    if (Array.isArray(raw.answers)) {
      return raw.answers
        .map(entry => ({ id: normalizeId(entry?.id), value: Number(entry?.value ?? 0) || 0 }))
        .filter(entry => entry.id);
    }
    const out = [];
    for (const [id, value] of Object.entries(raw)) {
      const norm = normalizeId(id);
      if (norm) out.push({ id: norm, value: Number(value ?? 0) || 0 });
    }
    return out;
  }

  function normalizeId(id) {
    if (id == null) return '';
    const key = String(id).trim().toLowerCase();
    return ID_PREFIXES.some(prefix => key.startsWith(prefix)) ? key : '';
  }

  function buildRows(listA, listB) {
    const mapA = listToMap(listA);
    const mapB = listToMap(listB);
    const ids = new Set([...mapA.keys(), ...mapB.keys()]);
    const rows = [];
    ids.forEach(id => {
      const a = mapA.has(id) ? mapA.get(id) : null;
      const b = mapB.has(id) ? mapB.get(id) : null;
      const pct = (Number.isFinite(a) && Number.isFinite(b))
        ? Math.max(0, Math.min(100, Math.round(100 - Math.abs(a - b) * 20)))
        : null;
      rows.push({ id, a, b, pct });
    });
    return { rows, mapA, mapB };
  }

  function listToMap(list) {
    const map = new Map();
    (list || []).forEach(item => {
      if (!item || !item.id) return;
      map.set(item.id, Number(item.value ?? 0) || 0);
    });
    return map;
  }

  function fmtScore(value) {
    const num = Number(value);
    return Number.isFinite(num) ? String(num) : '—';
  }

  function renderRow({ id, a, b, pct, label }) {
    const tr = document.createElement('tr');
    tr.dataset.id = id;

    const tdCat = document.createElement('td');
    tdCat.textContent = label || id;
    tr.appendChild(tdCat);

    const tdA = document.createElement('td');
    tdA.textContent = fmtScore(a);
    tr.appendChild(tdA);

    const tdPct = document.createElement('td');
    tdPct.className = 'tk-pct';
    const pctSafe = Number.isFinite(pct) ? Math.max(0, Math.min(100, pct)) : null;
    const pctText = Number.isFinite(pctSafe) ? `${pctSafe}%` : '—';
    tdPct.innerHTML = `
      <div class="tk-pct__bar" style="width:${pctSafe ?? 0}%;"></div>
      <span>${pctText}</span>
    `;
    tr.appendChild(tdPct);

    const tdB = document.createElement('td');
    tdB.textContent = fmtScore(b);
    tr.appendChild(tdB);

    return tr;
  }

  function mountMissingLabelsButton() {
    const labelsApi = window.tkLabels || window.TK_LABELS;
    if (!labelsApi || typeof labelsApi.collectMissing !== 'function') return;

    const missing = labelsApi.collectMissing(seenIds);
    if (!missing.length) {
      if (missingBtn) {
        missingBtn.remove();
        missingBtn = null;
      }
      return;
    }

    if (!missingBtn) {
      missingBtn = document.createElement('button');
      missingBtn.className = 'ksvBtn';
      missingBtn.style.position = 'fixed';
      missingBtn.style.right = '24px';
      missingBtn.style.bottom = '24px';
      document.body.appendChild(missingBtn);
    }

    missingBtn.textContent = missing.length > 0 ? `Missing labels (${missing.length})` : 'Missing labels';
    missingBtn.onclick = () => {
      const api = window.tkLabels || window.TK_LABELS;
      if (!api) return;
      const latest = api.collectMissing(seenIds);
      const msg = [
        `You have ${latest.length} ids without labels.`,
        'Add them to /data/labels-overrides.json.',
        '',
        latest.slice(0, 25).join(', ') + (latest.length > 25 ? ' …' : '')
      ].join('\n');
      alert(msg);
      api.downloadMissing(seenIds);
    };
    missingBtn.style.display = '';
  }

  function buildUnansweredTable(aMap, bMap) {
    const table = document.querySelector('#tk-unanswered tbody');
    if (!table) return;

    table.innerHTML = '';

    const hasResponses = (aMap && aMap.size) || (bMap && bMap.size);
    if (!hasResponses) {
      return;
    }

    Object.entries(GROUPS).forEach(([group, ids]) => {
      if (!Array.isArray(ids) || !ids.length) return;
      const anyA = ids.some(id => (aMap.get(id) ?? 0) > 0);
      const anyB = ids.some(id => (bMap.get(id) ?? 0) > 0);
      if (anyA || anyB) return;

      const tr = document.createElement('tr');
      const tdGroup = document.createElement('td');
      tdGroup.textContent = group;
      const tdA = document.createElement('td');
      const tdB = document.createElement('td');
      tdA.textContent = '’';
      tdB.textContent = '’';
      tr.appendChild(tdGroup);
      tr.appendChild(tdA);
      tr.appendChild(tdB);
      table.appendChild(tr);
    });
  }
})();
