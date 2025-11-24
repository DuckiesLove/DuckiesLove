window.TKCompatPDF = (function () {
  const ROW_STORAGE_KEYS = ['talkkink:compatRows', 'talkkink:compatibilityRows'];
  const SELF_KEYS = ['tk_compat.self', 'talkkink:compatSelf'];
  const PARTNER_KEYS = ['tk_compat.partner', 'talkkink:compatPartner'];

  let cachedRows = Array.isArray(window.talkkinkCompatRows)
    ? window.talkkinkCompatRows.slice()
    : [];

  const THEME = {
    bg: [6, 12, 20],
    panel: [14, 24, 36],
    badge: [18, 33, 47],
    grid: [46, 83, 107],
    accent: [48, 231, 231],
    accentAlt: [255, 116, 206],
    text: [233, 244, 247],
    muted: [173, 199, 205]
  };

  const JSPDF_LOCAL = [
    '/assets/js/vendor/jspdf.umd.min.js',
    '/js/vendor/jspdf.umd.min.js',
    '/vendor/jspdf.umd.min.js'
  ];

  const AUTOTABLE_LOCAL = [
    '/assets/js/vendor/jspdf.plugin.autotable.min.js',
    '/js/vendor/jspdf.plugin.autotable.min.js',
    '/vendor/jspdf.plugin.autotable.min.js'
  ];

  const JSPDF_CDN = ['https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js'];
  const AUTOTABLE_CDN = [
    'https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.3/dist/jspdf.plugin.autotable.min.js'
  ];

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

  function cleanValue(val) {
    if (val === undefined || val === null || val === '&&&') return '';
    return val;
  }

  function getCompatMatch(scoreA, scoreB) {
    const cleanA = cleanValue(scoreA);
    const cleanB = cleanValue(scoreB);

    if (cleanA === '' && cleanB === '') return null;
    if (cleanA === '' || cleanB === '') return null;

    const numA = Number(cleanA);
    const numB = Number(cleanB);
    if (!Number.isFinite(numA) || !Number.isFinite(numB)) return null;

    const diff = Math.abs(numA - numB);
    return Math.max(0, Math.min(100, Math.round(100 - diff * 20)));
  }

  function parseMatchPercentage(matchValue) {
    if (typeof matchValue === 'number' && Number.isFinite(matchValue)) return matchValue;
    if (typeof matchValue === 'string') {
      const parsed = parseInt(matchValue, 10);
      if (Number.isFinite(parsed)) return parsed;
    }
    return null;
  }

  function normalizeCompatTableRows(rows = []) {
    return rows.map((row) => {
      const rawA = Number(row.a ?? row.partnerA ?? row.aScore ?? row.scoreA);
      const rawB = Number(row.b ?? row.partnerB ?? row.bScore ?? row.scoreB);
      const scoreA = Number.isFinite(rawA) ? rawA : null;
      const scoreB = Number.isFinite(rawB) ? rawB : null;

      const matchFromRow = parseMatchPercentage(
        row.match ?? row.matchPct ?? row.matchPercent ?? row.matchValue
      );
      const matchPercent = Number.isFinite(matchFromRow)
        ? matchFromRow
        : getCompatMatch(scoreA, scoreB);

      return {
        label: row.item || row.label || '—',
        partnerA: scoreA,
        partnerB: scoreB,
        matchPercent: Number.isFinite(matchPercent) ? matchPercent : null
      };
    });
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

  function readSurveyPayloads() {
    return {
      self: readFirst(SELF_KEYS),
      partner: readFirst(PARTNER_KEYS)
    };
  }

  function rowsFromStorage(payloads) {
    if (cachedRows.length) return cachedRows.slice();

    const localRows = readFirst(ROW_STORAGE_KEYS);
    if (Array.isArray(localRows) && localRows.length) {
      cachedRows = localRows.slice();
      return cachedRows.slice();
    }

    if (payloads?.self || payloads?.partner) {
      const built = buildRows(payloads.self, payloads.partner);
      cachedRows = built.slice();
      return built;
    }

    return [];
  }

  function hasSurveyData(data) {
    return data?.meta && Array.isArray(data.answers) && data.answers.length > 0;
  }

  function isAutoTablePlaceholder(fn) {
    if (!fn) return true;
    try {
      const text = String(fn);
      return text.includes('placeholder');
    } catch (err) {
      return true;
    }
  }

  const getJsPdfCtor = () => (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;

  function attachAutoTablePlugin() {
    const JsPDF = getJsPdfCtor();
    const autoTableFn =
      window.jspdf?.autoTable || window.jspdf_autotable || window.autotable || window.autoTable;

    if (JsPDF?.API && !JsPDF.API.autoTable && typeof autoTableFn === 'function') {
      JsPDF.API.autoTable = autoTableFn;
    }
  }

  function hasRealAutoTable() {
    const apiFn =
      window.jspdf?.jsPDF?.API?.autoTable ||
      window.jsPDF?.API?.autoTable ||
      window.jspdf?.autoTable;

    return typeof apiFn === 'function' && !isAutoTablePlaceholder(apiFn);
  }

  function loadScript(src, label) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = (err) => {
        console.warn(`[compat-pdf] Failed to load ${label} script`, src, err);
        reject(err || new Error(`Failed to load ${label}`));
      };
      document.head.appendChild(script);
    });
  }

  async function tryLoadScripts(sources, label) {
    for (const src of sources) {
      try {
        await loadScript(src, label);
        return true;
      } catch (err) {
        console.warn(`[compat-pdf] ${label} load attempt failed`, src, err);
      }
    }
    return false;
  }

  async function ensurePdfLibraries() {
    if (hasRealAutoTable()) return;

    if (!getJsPdfCtor()) {
      const loadedLocalJsPdf = await tryLoadScripts(JSPDF_LOCAL, 'jsPDF');
      if (!loadedLocalJsPdf) {
        await tryLoadScripts(JSPDF_CDN, 'jsPDF');
      }
    }

    if (getJsPdfCtor() && !window.jsPDF) {
      window.jsPDF = getJsPdfCtor();
    }

    if (!hasRealAutoTable()) {
      const loadedLocalAutoTable = await tryLoadScripts(AUTOTABLE_LOCAL, 'jsPDF-AutoTable');
      if (!loadedLocalAutoTable && !hasRealAutoTable()) {
        await tryLoadScripts(AUTOTABLE_CDN, 'jsPDF-AutoTable');
      }
    }

    attachAutoTablePlugin();

    if (!hasRealAutoTable()) {
      throw new Error('jsPDF-AutoTable not available after loading attempts.');
    }
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

  function paintPageBackground(doc) {
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFillColor(...THEME.bg);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');
  }

  function renderHeader(doc, centerX, timestamp) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(26);
    doc.setTextColor(...THEME.accent);
    doc.text('TalkKink Compatibility', centerX, 48, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(...THEME.muted);
    doc.text(`Generated ${timestamp}`, centerX, 66, { align: 'center' });

    doc.setDrawColor(...THEME.accent);
    doc.setLineWidth(1.4);
    doc.line(48, 80, doc.internal.pageSize.getWidth() - 48, 80);
  }

  function renderStats(doc, rows, startY) {
    const count = rows.length;
    const withMatches = rows.filter((r) => Number.isFinite(r.matchPercent));
    const avgMatch = withMatches.length
      ? Math.round(
          withMatches.reduce((sum, r) => sum + (r.matchPercent ?? 0), 0) / withMatches.length
        )
      : null;
    const strong = withMatches.filter((r) => (r.matchPercent ?? 0) >= 80).length;

    const badges = [
      { label: 'Items Compared', value: count },
      { label: 'Avg Match', value: avgMatch != null ? `${avgMatch}%` : '—' },
      { label: '80%+ Alignments', value: strong }
    ];

    const boxWidth = (doc.internal.pageSize.getWidth() - 96) / badges.length;
    const boxHeight = 54;

    badges.forEach((badge, idx) => {
      const x = 48 + idx * boxWidth;
      doc.setFillColor(...THEME.badge);
      doc.setDrawColor(...THEME.grid);
      doc.setLineWidth(0.8);
      doc.roundedRect(x, startY, boxWidth - 12, boxHeight, 6, 6, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(...THEME.accent);
      doc.text(String(badge.value), x + 12, startY + 24);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(...THEME.muted);
      doc.text(badge.label, x + 12, startY + 42);
    });

    return startY + boxHeight + 18;
  }

  function renderCompatTable(doc, rows, startY) {
    if (!rows.length) return startY;

    const tableBody = rows.map((row) => [
      row.label,
      Number.isFinite(row.partnerA) ? row.partnerA : '—',
      Number.isFinite(row.matchPercent) ? `${Math.round(row.matchPercent)}%` : '—',
      Number.isFinite(row.partnerB) ? row.partnerB : '—'
    ]);

    const autoTable = getAutoTable(doc);
    if (!doc.autoTable && typeof autoTable === 'function') {
      doc.autoTable = (opts) => autoTable(opts);
    }

    autoTable({
      startY,
      head: [['Item', 'Partner A', 'Match', 'Partner B']],
      body: tableBody,
      margin: { left: 48, right: 48 },
      styles: {
        fontSize: 10,
        font: 'helvetica',
        textColor: THEME.text,
        cellPadding: { top: 9, right: 10, bottom: 9, left: 10 },
        overflow: 'linebreak',
        lineColor: THEME.grid,
        lineWidth: 0.35,
        fillColor: THEME.panel,
        valign: 'middle'
      },
      columnStyles: {
        0: { cellWidth: 'auto', halign: 'left', textColor: [170, 222, 232] },
        1: { cellWidth: 70, halign: 'center' },
        2: { cellWidth: 68, halign: 'center', textColor: THEME.accent },
        3: { cellWidth: 70, halign: 'center' }
      },
      headStyles: {
        fillColor: THEME.panel,
        textColor: THEME.accent,
        fontStyle: 'bold',
        fontSize: 12,
        lineColor: THEME.grid,
        lineWidth: 0.8,
        halign: 'center'
      },
      alternateRowStyles: {
        fillColor: [10, 18, 28]
      },
      didParseCell: (data) => {
        if (data.section !== 'body') return;
        if (data.column.index === 2 && data.cell.raw === '—') {
          data.cell.styles.textColor = THEME.muted;
        }
      }
    });

    return doc.lastAutoTable?.finalY ?? startY;
  }

  async function generateFromStorage() {
    const payloads = readSurveyPayloads();

    if (!hasSurveyData(payloads.self) || !hasSurveyData(payloads.partner)) {
      console.error('[compat-override] PDF generation failed: Missing survey data.', payloads);
      alert('Error: One or both surveys are missing. Make sure both are uploaded.');
      return;
    }

    const rawRows = rowsFromStorage(payloads);
    if (!rawRows.length) {
      alert('Upload both partner surveys first, then try again.');
      return;
    }

    try {
      await ensurePdfLibraries();
    } catch (err) {
      console.error('[compat-pdf] PDF libraries failed to load', err);
      alert('PDF could not be generated because required libraries did not load.');
      return;
    }

    if (!hasRealAutoTable()) {
      console.error('[compat-pdf] PDF generation aborted: AutoTable missing.');
      alert('PDF could not be generated because the AutoTable plugin is unavailable.');
      return;
    }

    const JsPDF = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
    if (typeof JsPDF !== 'function') {
      alert('PDF could not be generated because jsPDF is unavailable.');
      return;
    }

    try {
      const doc = new JsPDF({ putOnlyUsedFonts: true, unit: 'pt', format: 'a4', orientation: 'p' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const headerCenterX = pageWidth / 2;
      const timestamp = new Date().toLocaleString();

      paintPageBackground(doc);
      renderHeader(doc, headerCenterX, timestamp);

      const normalizedRows = normalizeCompatTableRows(rawRows);
      const tableStartY = renderStats(doc, normalizedRows, 98);
      renderCompatTable(doc, normalizedRows, tableStartY + 6);

      doc.save('TalkKink-Compatibility.pdf');
    } catch (err) {
      console.error('[compat-pdf] PDF generation failed', err);
      alert('PDF generation failed because of an unexpected error.');
    }
  }

  function notifyRowsUpdated(rows) {
    cachedRows = Array.isArray(rows) ? rows.slice() : [];
  }

  return {
    generateFromStorage,
    notifyRowsUpdated
  };
})();
