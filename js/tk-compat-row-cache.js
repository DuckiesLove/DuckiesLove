(function(){
  const ROW_KEYS = ['talkkink:compatRows', 'talkkink:compatibilityRows'];
  const DEFAULT_SELF_KEY = 'tk_compat.self';
  const DEFAULT_PARTNER_KEY = 'tk_compat.partner';
  const SIDE_LABEL = { giving: 'Giving', receiving: 'Receiving', general: 'General' };
  const COMPLEMENT = { giving: 'receiving', receiving: 'giving', general: 'general' };

  const cfg = (typeof window !== 'undefined' && window.TK_COMPAT_UPLOAD_CFG) || {};
  const SELF_KEY = cfg.lsSelfKey || DEFAULT_SELF_KEY;
  const PARTNER_KEY = cfg.lsPartKey || DEFAULT_PARTNER_KEY;

  function safeString(value) {
    if (value == null) return '';
    const str = String(value).trim();
    return str;
  }

  function normalizeSide(side) {
    const raw = safeString(side).toLowerCase();
    if (raw.startsWith('giv')) return 'giving';
    if (raw.startsWith('rec')) return 'receiving';
    return 'general';
  }

  function complementSide(side) {
    return COMPLEMENT[side] || 'general';
  }

  function clampScore(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return null;
    if (num < 0) return 0;
    if (num > 5) return 5;
    return Math.round(num * 100) / 100;
  }

  function labelFor(side, answer) {
    const prefix = SIDE_LABEL[side] || 'General';
    const title = safeString(
      answer?.title ||
        answer?.label ||
        answer?.name ||
        answer?.prompt ||
        answer?.question ||
        answer?.category ||
        answer?.kinkId ||
        ''
    );
    const category = safeString(answer?.category || answer?.categoryLabel);
    if (title && category && !title.toLowerCase().includes(category.toLowerCase())) {
      return `${prefix}: ${title} (${category})`;
    }
    return title ? `${prefix}: ${title}` : `${prefix}: Item ${safeString(answer?.kinkId)}`;
  }

  function answerMap(payload) {
    const map = new Map();
    if (!payload || typeof payload !== 'object') return map;
    const answers = Array.isArray(payload.answers) ? payload.answers : [];
    answers.forEach((entry) => {
      const kinkId = entry?.kinkId ?? entry?.id ?? entry?.key;
      if (kinkId == null) return;
      const side = normalizeSide(entry?.side);
      const key = `${kinkId}::${side}`;
      const score = clampScore(entry?.score ?? entry?.value ?? entry?.rating);
      if (score == null) return;
      map.set(key, { score });
    });
    return map;
  }

  function readJson(key) {
    if (!key || typeof localStorage === 'undefined') return null;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (err) {
      console.warn('[compat-row-cache] Failed reading', key, err);
      return null;
    }
  }

  function readStoredRows() {
    if (typeof localStorage === 'undefined') return [];
    for (const key of ROW_KEYS) {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) {
          return parsed;
        }
      } catch (err) {
        console.warn('[compat-row-cache] Failed parsing stored rows', err);
      }
    }
    return [];
  }

  function persistRows(rows) {
    if (typeof localStorage === 'undefined') return false;
    let serialized;
    try {
      serialized = JSON.stringify(rows);
    } catch (err) {
      console.warn('[compat-row-cache] Unable to serialize rows', err);
      return false;
    }
    ROW_KEYS.forEach((key) => {
      try {
        localStorage.setItem(key, serialized);
      } catch (err) {
        console.warn('[compat-row-cache] Unable to write', key, err);
      }
    });
    if (Array.isArray(rows)) {
      window.talkkinkCompatRows = rows.slice();
      if (window.TKCompatPDF && typeof window.TKCompatPDF.notifyRowsUpdated === 'function') {
        window.TKCompatPDF.notifyRowsUpdated(rows.slice());
      }
    }
    return true;
  }

  function clearRows() {
    if (typeof localStorage === 'undefined') return;
    ROW_KEYS.forEach((key) => {
      try {
        localStorage.removeItem(key);
      } catch (err) {
        console.warn('[compat-row-cache] Unable to remove', key, err);
      }
    });
    delete window.talkkinkCompatRows;
    if (window.TKCompatPDF && typeof window.TKCompatPDF.notifyRowsUpdated === 'function') {
      window.TKCompatPDF.notifyRowsUpdated([]);
    }
  }

  function buildRows(self, partner) {
    const selfAnswers = Array.isArray(self?.answers) ? self.answers : [];
    const partnerAnswers = Array.isArray(partner?.answers) ? partner.answers : [];
    if (!selfAnswers.length && !partnerAnswers.length) return [];

    const rowsByKey = new Map();
    const rows = [];
    const selfMap = answerMap(self);
    const partnerMap = answerMap(partner);

    const getScore = (map, kinkId, side) => {
      const key = `${kinkId}::${side}`;
      const record = map.get(key);
      return record ? record.score : null;
    };

    const ensureRow = (kinkId, side, meta) => {
      if (kinkId == null) return null;
      const key = `${kinkId}::${side}`;
      let row = rowsByKey.get(key);
      if (!row) {
        row = { kinkId: String(kinkId), side, item: labelFor(side, meta || { kinkId }) };
        rowsByKey.set(key, row);
      } else if ((!row.item || row.item === key) && meta) {
        row.item = labelFor(side, meta);
      }
      return row;
    };

    selfAnswers.forEach((entry) => {
      const kinkId = entry?.kinkId ?? entry?.id ?? entry?.key;
      if (kinkId == null) return;
      const side = normalizeSide(entry?.side);
      ensureRow(kinkId, side, entry);
    });

    partnerAnswers.forEach((entry) => {
      const kinkId = entry?.kinkId ?? entry?.id ?? entry?.key;
      if (kinkId == null) return;
      const targetSide = complementSide(normalizeSide(entry?.side));
      ensureRow(kinkId, targetSide, entry);
    });

    rowsByKey.forEach((row) => {
      const { kinkId, side } = row;
      const aScore = getScore(selfMap, kinkId, side);
      const bScore = getScore(partnerMap, kinkId, complementSide(side));
      if (aScore == null && bScore == null) return;
      rows.push({ item: row.item, a: aScore, b: bScore });
    });

    rows.sort((a, b) => a.item.localeCompare(b.item, undefined, { sensitivity: 'base' }));
    return rows;
  }

  function ensureCompatRows(opts = {}) {
    const force = Boolean(opts.force);
    const existing = readStoredRows();
    if (existing.length && !force) {
      window.talkkinkCompatRows = existing.slice();
      return true;
    }

    const self = readJson(SELF_KEY);
    const partner = readJson(PARTNER_KEY);
    if (!self || !partner) return false;

    const rows = buildRows(self, partner);
    if (!rows.length) return false;
    persistRows(rows);
    return true;
  }

  window.talkkinkEnsureCompatRows = ensureCompatRows;

  document.addEventListener('tk-compat-upload', () => {
    ensureCompatRows({ force: true });
  });

  document.addEventListener('tk-compat-upload-error', (event) => {
    const detail = event?.detail || {};
    if (detail?.who === 'self' || detail?.who === 'partner') {
      clearRows();
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => ensureCompatRows());
  } else {
    ensureCompatRows();
  }
})();
