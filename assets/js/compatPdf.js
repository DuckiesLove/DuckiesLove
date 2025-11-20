window.TKCompatPDF = (function () {
  const ROW_STORAGE_KEYS = ['talkkink:compatRows', 'talkkink:compatibilityRows'];
  const SELF_KEYS = ['tk_compat.self', 'talkkink:compatSelf'];
  const PARTNER_KEYS = ['tk_compat.partner', 'talkkink:compatPartner'];

  let cachedRows = Array.isArray(window.talkkinkCompatRows)
    ? window.talkkinkCompatRows.slice()
    : [];

  function safeString(value) {
    if (value == null) return '';
    return String(value).trim();
  }

  function normalizeSide(side) {
    const raw = safeString(side).toLowerCase();
    if (raw.startsWith('giv')) return 'giving';
    if (raw.startsWith('rec')) return 'receiving';
    return 'general';
  }

  function complementSide(side) {
    if (side === 'giving') return 'receiving';
    if (side === 'receiving') return 'giving';
    return 'general';
  }

  function clampScore(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return null;
    if (num < 0) return 0;
    if (num > 5) return 5;
    return Math.round(num * 100) / 100;
  }

  function labelFor(side, answer) {
    const prefix = side === 'giving' ? 'Giving' : side === 'receiving' ? 'Receiving' : 'General';
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
      map.set(key, { score, meta: entry });
    });
    return map;
  }

  function buildRows(self, partner) {
    const selfMap = answerMap(self);
    const partnerMap = answerMap(partner);
    const rowMap = new Map();

    function ensureRow(kinkId, side, meta) {
      if (kinkId == null) return null;
      const key = `${kinkId}::${side}`;
      let row = rowMap.get(key);
      if (!row) {
        row = { kinkId: String(kinkId), side, item: labelFor(side, meta || { kinkId }) };
        rowMap.set(key, row);
      } else if ((!row.item || row.item === key) && meta) {
        row.item = labelFor(side, meta);
      }
      return row;
    }

    selfMap.forEach((value, key) => {
      const [kinkId, side] = key.split('::');
      ensureRow(kinkId, side, value.meta);
    });

    partnerMap.forEach((value, key) => {
      const [kinkId, side] = key.split('::');
      ensureRow(kinkId, complementSide(side), value.meta);
    });

    const rows = [];
    rowMap.forEach((row) => {
      const { kinkId, side } = row;
      const aKey = `${kinkId}::${side}`;
      const bKey = `${kinkId}::${complementSide(side)}`;
      const aScore = selfMap.get(aKey)?.score ?? null;
      const bScore = partnerMap.get(bKey)?.score ?? null;
      if (aScore == null && bScore == null) return;
      rows.push({ item: row.item, a: aScore, b: bScore });
    });

    rows.sort((a, b) => a.item.localeCompare(b.item, undefined, { sensitivity: 'base' }));
    return rows;
  }

  function computeMatch(a, b) {
    if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
    const diff = Math.abs(a - b);
    const percent = Math.max(0, Math.min(100, Math.round((1 - diff / 5) * 100)));
    return percent;
  }

  function formatScore(value) {
    if (value == null) return '';
    if (!Number.isFinite(value)) return '';
    if (Number.isInteger(value)) return String(value);
    return value.toFixed(2);
  }

  function readJson(key) {
    if (!key) return null;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (err) {
      console.warn('[TKCompatPDF] Failed to read', key, err);
      return null;
    }
  }

  function readFirst(keys) {
    for (const key of keys) {
      const parsed = readJson(key);
      if (parsed) return parsed;
    }
    return null;
  }

  function rowsFromStorage() {
    if (Array.isArray(cachedRows) && cachedRows.length) {
      return cachedRows.slice();
    }

    for (const key of ROW_STORAGE_KEYS) {
      const parsed = readJson(key);
      if (Array.isArray(parsed) && parsed.length) {
        cachedRows = parsed.slice();
        return cachedRows.slice();
      }
    }

    const self = readFirst(SELF_KEYS);
    const partner = readFirst(PARTNER_KEYS);
    if (!self || !partner) return [];

    const rows = buildRows(self, partner);
    cachedRows = rows.slice();
    return rows;
  }

  function ensureJsPDF() {
    const ctor = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
    if (typeof ctor === 'function') return ctor;
    throw new Error('jsPDF is not loaded.');
  }

  function getAutoTable(doc) {
    if (doc && typeof doc.autoTable === 'function') {
      return (opts) => doc.autoTable(opts);
    }

    const api = doc?.constructor?.API?.autoTable;
    if (typeof api === 'function') {
      return (opts) => api.call(doc, opts);
    }

    if (typeof window.jspdf?.autoTable === 'function') {
      return (opts) => window.jspdf.autoTable(doc, opts);
    }

    throw new Error('jsPDF autoTable plugin is not loaded.');
  }

  async function generateFromStorage() {
    const rows = rowsFromStorage();
    if (!rows.length) {
      alert('Upload both partner surveys first, then try again.');
      return;
    }

    const JsPDF = ensureJsPDF();
    const doc = new JsPDF({ putOnlyUsedFonts: true, unit: 'pt', format: 'letter' });
    const autoTable = getAutoTable(doc);
    const margin = 40;

    doc.setFontSize(18);
    doc.text('TalkKink Compatibility', margin, margin);
    doc.setFontSize(11);
    doc.text('Side-by-side scores for you and your partner', margin, margin + 16);

    const tableData = rows.map((row) => {
      const match = computeMatch(row.a, row.b);
      const matchText = match == null ? '' : `${match}%`;
      return {
        item: row.item,
        self: formatScore(row.a),
        partner: formatScore(row.b),
        match: matchText
      };
    });

    autoTable({
      startY: margin + 30,
      head: [['Item', 'You', 'Partner', 'Match']],
      body: tableData.map((r) => [r.item, r.self, r.partner, r.match]),
      styles: { fontSize: 9, cellPadding: 6 },
      headStyles: { fillColor: [0, 0, 0], textColor: 255 },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      columnStyles: {
        1: { halign: 'center', cellWidth: 60 },
        2: { halign: 'center', cellWidth: 70 },
        3: { halign: 'center', cellWidth: 60 }
      }
    });

    doc.save('TalkKink_Compatibility_Report.pdf');
  }

  function notifyRowsUpdated(rows) {
    cachedRows = Array.isArray(rows) ? rows.slice() : [];
  }

  return {
    generateFromStorage,
    notifyRowsUpdated
  };
})();
