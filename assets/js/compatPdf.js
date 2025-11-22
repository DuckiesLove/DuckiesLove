window.TKCompatPDF = (function () {
  const ROW_STORAGE_KEYS = ['talkkink:compatRows', 'talkkink:compatibilityRows'];
  const SELF_KEYS = ['tk_compat.self', 'talkkink:compatSelf'];
  const PARTNER_KEYS = ['tk_compat.partner', 'talkkink:compatPartner'];

  let cachedRows = Array.isArray(window.talkkinkCompatRows)
    ? window.talkkinkCompatRows.slice()
    : [];

  const log = (...args) => console.log('[compat-pdf]', ...args);

  const THEME = {
    bg: [10, 20, 28],
    panel: [12, 29, 37],
    row: [12, 31, 41],
    rowAlt: [10, 27, 35],
    grid: [15, 70, 88],
    accent: [9, 225, 255],
    ink: [230, 254, 255],
    inkDim: [184, 223, 224]
  };

  const toRGB = (arr = []) => arr.slice(0, 3);

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

  function cleanValue(val) {
    if (val === undefined || val === null || val === '&&&') return '';
    return val;
  }

  const hasSurveyData = (data) => data?.meta && Array.isArray(data.answers) && data.answers.length > 0;

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

  const JSPDF_CDN = [
    'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js'
  ];

  const AUTOTABLE_CDN = [
    'https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.3/dist/jspdf.plugin.autotable.min.js'
  ];

  let pdfLibLoadPromise = null;

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

  function getCompatMatch(scoreA, scoreB) {
    const cleanA = cleanValue(scoreA);
    const cleanB = cleanValue(scoreB);

    if (cleanA === '' && cleanB === '') return 'N/A';
    if (cleanA === '' || cleanB === '') return '';

    const numA = Number(cleanA);
    const numB = Number(cleanB);
    if (!Number.isFinite(numA) || !Number.isFinite(numB)) return '';

    const diff = Math.abs(numA - numB);
    const percent = Math.max(0, Math.min(100, Math.round(100 - diff * 20)));
    return `${percent}%`;
  }

  function deriveCategoryLabel(payloads) {
    return (
      payloads?.self?.meta?.categoryLabel ||
      payloads?.self?.meta?.category ||
      payloads?.partner?.meta?.categoryLabel ||
      payloads?.partner?.meta?.category ||
      'Compatibility Results'
    );
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

  // 🔧 Label shortening map
  const labelShortMap = {
    'Appearance Play': 'Appearance',
    'Breath Play': 'Breath',
    'Psychological & Emotional': 'Emotional',
    'Communication & Emotional Language': 'Communication',
    'High-Intensity Kinks (SSC-Aware)': 'High-Intensity',
    'Bondage & Control': 'Bondage',
    'Body Fluids & Excretions': 'Fluids',
    'Group & Public Play': 'Group Play',
    'Physical Impact': 'Impact',
    'Power Exchange': 'Power',
    'Roleplay & Fantasy': 'Roleplay',
    'Rituals & Protocols': 'Rituals',
    'Service & Devotion': 'Service',
    'Toys & Tools': 'Toys'
  };

    // 🧠 Core table rendering (safe fallback for empty rows)
    function renderCompatCategoryTable(doc, category, rows, startY) {
    if (!rows || rows.length === 0) return startY ?? 10;

    const pageWidth = doc.internal.pageSize.getWidth();
    const marginX = 40;
    const usableWidth = pageWidth - marginX * 2;
    const colWidths = {
      label: usableWidth * 0.56,
      partner: usableWidth * 0.12,
      match: usableWidth * 0.20
    };

    const tableBody = rows.map(row => {
      const shortLabel = labelShortMap[row.label] || row.label;
      const matchPercent = row.matchPercent ?? NaN;
      return [
        shortLabel,
        formatScore(row.partnerA),
        formatMatch(matchPercent),
        formatScore(row.partnerB)
      ];
    });

    doc.autoTable({
      head: [['Kinks', 'Partner A', 'Match', 'Partner B']],
      body: tableBody,
      startY: startY ?? 10,
      margin: { left: marginX, right: marginX },
      styles: {
        fontSize: 10,
        font: 'helvetica',
        textColor: toRGB(THEME.ink),
        cellPadding: { top: 10, right: 8, bottom: 10, left: 8 },
        overflow: 'linebreak',
        valign: 'middle',
        lineColor: toRGB(THEME.grid),
        lineWidth: 0.35,
        fillColor: toRGB(THEME.row)
      },
      headStyles: {
        fillColor: toRGB(THEME.panel),
        textColor: toRGB(THEME.accent),
        fontSize: 12,
        fontStyle: 'bold',
        halign: 'center',
        lineColor: toRGB(THEME.grid),
        lineWidth: 0.8
      },
      alternateRowStyles: {
        fillColor: toRGB(THEME.rowAlt)
      },
      columnStyles: {
        0: { cellWidth: colWidths.label, halign: 'left', textColor: [142, 214, 232] },
        1: { cellWidth: colWidths.partner, halign: 'center' },
        2: { cellWidth: colWidths.match, halign: 'center', textColor: toRGB(THEME.accent) },
        3: { cellWidth: colWidths.partner, halign: 'center' }
      },
      didParseCell: (data) => {
        if (data.section !== 'body') return;
        if (data.column.index === 2 && data.cell.raw === '—') {
          data.cell.styles.textColor = toRGB(THEME.inkDim);
        }
      }
    });

    const lastY = doc.lastAutoTable?.finalY;
    const prevY = doc.previousAutoTable?.finalY;
    return lastY ?? prevY ?? startY ?? 10;
  }

  function parseMatchPercentage(matchValue) {
    if (typeof matchValue === 'number' && Number.isFinite(matchValue)) return matchValue;
    if (typeof matchValue === 'string') {
      const parsed = parseInt(matchValue, 10);
      if (Number.isFinite(parsed)) return parsed;
    }
    return null;
  }

  function formatScore(value) {
    if (Number.isFinite(value)) return String(value);
    const text = safeString(value);
    return text || '—';
  }

  function formatMatch(matchPercent) {
    if (!Number.isFinite(matchPercent)) return '—';
    const rounded = Math.round(matchPercent);
    return rounded === 100 ? '100% ★' : `${rounded}%`;
  }

  function normalizeCompatTableRows(rows = []) {
    return rows.map((row) => {
      const rawA = Number(row.a);
      const rawB = Number(row.b);
      const scoreA = Number.isFinite(rawA) ? rawA : null;
      const scoreB = Number.isFinite(rawB) ? rawB : null;
      const match = parseMatchPercentage(getCompatMatch(scoreA, scoreB));

      return {
        label: row.item || '—',
        partnerA: scoreA,
        partnerB: scoreB,
        matchPercent: Number.isFinite(match) ? match : NaN,
      };
    });
  }

  function readSurveyPayloads() {
    return {
      self: readFirst(SELF_KEYS),
      partner: readFirst(PARTNER_KEYS)
    };
  }

  function rowsFromStorage(payloads = {}) {
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

    const self = payloads.self ?? readFirst(SELF_KEYS);
    const partner = payloads.partner ?? readFirst(PARTNER_KEYS);
    if (!self || !partner) return [];

    const rows = buildRows(self, partner);
    cachedRows = rows.slice();
    return rows;
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
      console.warn('[compat-pdf] AutoTable not found. Injecting manually.');
      JsPDF.API.autoTable = autoTableFn;
    }
  }

  function ensureJsPDF() {
    const ctor = getJsPdfCtor();
    if (typeof ctor === 'function') return ctor;
    throw new Error('jsPDF is not loaded.');
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

  function injectScript(url) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = url;
      script.async = false;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`Failed to load script: ${url}`));
      document.head.appendChild(script);
    });
  }

  async function ensurePdfLibraries() {
    if (hasRealAutoTable()) return;
    if (pdfLibLoadPromise) {
      await pdfLibLoadPromise;
      return;
    }

    pdfLibLoadPromise = (async () => {
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

      if (!hasRealAutoTable()) {
        log('AutoTable missing after standard loaders, attempting direct injection...');
        if (!getJsPdfCtor()) {
          log('Injecting jsPDF...');
          for (const src of JSPDF_CDN) {
            try {
              await injectScript(src);
              break;
            } catch (err) {
              console.warn('[compat-pdf] Direct jsPDF injection failed', src, err);
            }
          }
        }

        if (getJsPdfCtor() && !window.jsPDF) {
          window.jsPDF = getJsPdfCtor();
        }

        if (!hasRealAutoTable()) {
          log('Injecting AutoTable...');
          for (const src of AUTOTABLE_CDN) {
            try {
              await injectScript(src);
              if (hasRealAutoTable()) break;
            } catch (err) {
              console.warn('[compat-pdf] Direct AutoTable injection failed', src, err);
            }
          }
        }
      }

      attachAutoTablePlugin();

      if (!hasRealAutoTable()) {
        throw new Error('jsPDF-AutoTable not available after loading attempts.');
      }

      log('jsPDF-AutoTable loaded successfully.');
    })();

    try {
      await pdfLibLoadPromise;
    } catch (err) {
      pdfLibLoadPromise = null;
      throw err;
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

  async function generateFromStorage() {
    const payloads = readSurveyPayloads();

    if (!hasSurveyData(payloads.self) || !hasSurveyData(payloads.partner)) {
      console.error('[compat-override] PDF generation failed: Missing survey data.', payloads);
      alert('Error: One or both surveys are missing. Make sure both are uploaded.');
      return;
    }

    const rows = rowsFromStorage(payloads);
    if (!rows.length) {
      alert('Upload both partner surveys first, then try again.');
      return;
    }

    try {
      await ensurePdfLibraries();
      attachAutoTablePlugin();
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

    try {
      const JsPDF = ensureJsPDF();
      const doc = new JsPDF({ putOnlyUsedFonts: true, unit: 'pt', format: 'a4', orientation: 'p' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const headerCenterX = pageWidth / 2 - 20;
      const autoTable = getAutoTable(doc);
      if (!doc.autoTable && typeof autoTable === 'function') {
        doc.autoTable = (opts) => autoTable(opts);
      }

      const timestamp = new Date().toLocaleString();
      const categoryLabel = deriveCategoryLabel(payloads);

      doc.setFillColor(...toRGB(THEME.bg));
      doc.rect(0, 0, pageWidth, pageHeight, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(26);
      doc.setTextColor(...toRGB(THEME.accent));
      doc.text('TalkKink Compatibility Survey', headerCenterX, 38, { align: 'center' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.setTextColor(...toRGB(THEME.inkDim));
      doc.text(`Generated: ${timestamp}`, headerCenterX, 54, { align: 'center' });

      doc.setDrawColor(...toRGB(THEME.accent));
      doc.setLineWidth(1.5);
      doc.line(40, 64, pageWidth - 40, 64);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(22);
      doc.setTextColor(...toRGB(THEME.accent));
      doc.text(categoryLabel, headerCenterX, 92, { align: 'center' });

      const tableRows = normalizeCompatTableRows(rows);

      renderCompatCategoryTable(doc, { items: tableRows, label: categoryLabel }, tableRows, 108);

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
