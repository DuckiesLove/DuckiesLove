const STATE = {
  map: null,
  api: null,
  promise: null,
};

if (typeof window !== 'undefined') {
  const placeholder = window.TK_LABELS || {
    relabelTable,
    loadLabels,
    load: loadLabels,
    label: () => null,
  };
  window.TK_LABELS = placeholder;
  window.TKLabels = placeholder;
}

function normalizeKey(id) {
  if (id == null) return '';
  return String(id).trim().toLowerCase();
}

function humanizeId(id) {
  return id == null ? '' : String(id);
}

function flattenLabelMap(raw) {
  if (!raw || typeof raw !== 'object') return {};
  const source = (raw.labels && typeof raw.labels === 'object') ? raw.labels : raw;
  const out = {};
  for (const [key, value] of Object.entries(source)) {
    const normKey = normalizeKey(key);
    if (!normKey || typeof value !== 'string') continue;
    out[normKey] = value;
  }
  return out;
}

function mergeLabelMaps(base, override) {
  const merged = { ...base };
  for (const [key, value] of Object.entries(override || {})) {
    const normKey = normalizeKey(key);
    if (!normKey || typeof value !== 'string') continue;
    merged[normKey] = value;
  }
  return merged;
}

async function buildApi() {
  const base = await safeFetchJSON('/data/kinks.json');
  const over = await safeFetchJSON('/data/labels-overrides.json');
  const merged = mergeLabelMaps(flattenLabelMap(base), flattenLabelMap(over));
  STATE.map = merged;
  console.info('[labels] merged %d entries', Object.keys(merged).length);

  const api = {
    async load() {
      await loadLabels();
      return STATE.map;
    },
    relabelTable,
    getLabel(id) {
      if (!STATE.map) return humanizeId(id);
      const key = normalizeKey(id);
      return key && STATE.map[key] ? STATE.map[key] : humanizeId(id);
    },
    label(id) {
      const key = normalizeKey(id);
      if (!key || !STATE.map || !STATE.map[key]) return null;
      return STATE.map[key];
    },
  };

  return api;
}

export async function safeFetchJSON(url) {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
      if (res.status === 404) {
        console.info(`[labels] ${url} not found (404 ok)`);
        return {};
      }
      throw new Error(`${res.status} ${res.statusText}`);
    }
    return await res.json();
  } catch (err) {
    console.warn(`[labels] failed ${url}:`, err);
    return {};
  }
}

export async function loadLabels() {
  if (STATE.api) return STATE.api;
  if (!STATE.promise) {
    STATE.promise = buildApi().then(api => {
      STATE.api = {
        getLabel: api.getLabel,
        map: { ...STATE.map },
      };
      if (typeof window !== 'undefined') {
        const globalApi = {
          relabelTable: api.relabelTable,
          loadLabels,
          load: api.load,
          label: api.label,
        };
        window.TK_LABELS = globalApi;
        window.TKLabels = globalApi;
      }
      return STATE.api;
    }).catch(err => {
      STATE.promise = null;
      throw err;
    });
  }
  return STATE.promise;
}

export function fmtCell(val, suffix = '') {
  return Number.isFinite(val) ? `${val}${suffix}` : '—';
}

function sleep(ms = 0) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function findCode(text) {
  const trimmed = String(text || '').trim();
  const match = /^cb_[a-z0-9]+$/i.exec(trimmed);
  return match ? match[0].toLowerCase() : null;
}

async function relabelTable(table) {
  const labels = await loadLabels();
  const map = labels.map || {};
  let host = table;
  if (!host) host = document.querySelector('table');
  if (!host) return;

  const rows = Array.from(host.querySelectorAll('tbody tr, tr')).filter(r => r.children.length >= 1);
  const missing = new Set();

  for (let i = 0; i < rows.length; i += 1) {
    const cell = rows[i].children[0];
    if (!cell) continue;
    const raw = cell.textContent.trim();
    const code = findCode(raw);
    if (!code) continue;

    const pretty = map[code];
    if (pretty) {
      cell.textContent = pretty;
      cell.dataset.code = code;
    } else {
      cell.dataset.code = code;
      missing.add(code);
    }

    if (i % 25 === 0) await sleep(0);
  }

  wireMissingPill(missing);
}

function wireMissingPill(missingSet) {
  let pill = document.querySelector('#tk-missing-pill');
  if (!pill) {
    pill = document.createElement('button');
    pill.id = 'tk-missing-pill';
    pill.textContent = 'Missing labels';
    pill.style.cssText = `
      position:fixed; right:16px; bottom:16px; z-index:99999;
      background:#001f26; color:#00e6ff; border:2px solid #00e6ff;
      padding:10px 14px; border-radius:12px; font-weight:700;
      box-shadow:0 0 12px rgba(0,230,255,.3); cursor:pointer;
    `;
    pill.addEventListener('click', () => {
      const missing = collectMissing();
      const blob = new Blob([JSON.stringify(missing, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'missing-labels.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
    });
    document.body.appendChild(pill);
  }

  const count = (missingSet && missingSet.size) || Object.keys(collectMissing()).length;
  pill.style.display = count ? 'inline-block' : 'none';
  pill.textContent = count ? `Missing labels (${count})` : 'Missing labels';
}

function collectMissing() {
  const out = {};
  const map = STATE.map || {};
  document.querySelectorAll('td[data-code], th[data-code]').forEach(td => {
    const code = (td.getAttribute('data-code') || '').toLowerCase();
    if (code && !map[code]) out[code] = '';
  });
  return out;
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => relabelTable(), 0);
    window.addEventListener('tk:compat:table-ready', () => relabelTable());
  });
}
