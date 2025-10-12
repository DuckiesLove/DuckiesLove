const BUTTON_SELECTOR = '#downloadBtn, #downloadPdfBtn, [data-download-pdf]';
const DEFAULT_COLUMNS = [
  { header: 'Category', dataKey: 'category', align: 'left' },
  { header: 'Partner A', dataKey: 'A', align: 'right' },
  { header: 'Match', dataKey: 'pct', align: 'center' },
  { header: 'Partner B', dataKey: 'B', align: 'right' },
];

const hasDOM = typeof window !== 'undefined' && typeof document !== 'undefined';

function loadScript(src) {
  if (!hasDOM || typeof document.createElement !== 'function') {
    return Promise.reject(new Error('DOM unavailable'));
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    (document.head || document.documentElement || document.body)?.appendChild(script);
  });
}

function getJsPDF() {
  if (typeof window === 'undefined') return null;
  return window.jspdf?.jsPDF || window.jsPDF || null;
}

async function ensurePdfLibs() {
  if (!hasDOM) return;
  if (!getJsPDF()) {
    const sources = [
      '/js/vendor/jspdf.umd.min.js',
      './js/vendor/jspdf.umd.min.js',
      'https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js',
    ];
    for (const src of sources) {
      try {
        await loadScript(src);
        if (getJsPDF()) break;
      } catch (_) {
        /* ignore */
      }
    }
  }

  if (window.jspdf?.jsPDF && !window.jsPDF) {
    window.jsPDF = window.jspdf.jsPDF;
  }

  const hasAutoTable =
    (window.jspdf && window.jspdf.autoTable) ||
    (window.jsPDF && window.jsPDF.API && window.jsPDF.API.autoTable);

  if (!hasAutoTable) {
    const sources = [
      '/js/vendor/jspdf.plugin.autotable.min.js',
      './js/vendor/jspdf.plugin.autotable.min.js',
      'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.3/jspdf.plugin.autotable.min.js',
    ];
    for (const src of sources) {
      try {
        await loadScript(src);
        const available =
          (window.jspdf && window.jspdf.autoTable) ||
          (window.jsPDF && window.jsPDF.API && window.jsPDF.API.autoTable);
        if (available) break;
      } catch (_) {
        /* ignore */
      }
    }
  }
}

function normalizeColumns(columns) {
  if (!Array.isArray(columns) || !columns.length) {
    return DEFAULT_COLUMNS.map((col) => ({ ...col }));
  }
  return columns.map((col, idx) => ({
    header: col?.header ?? DEFAULT_COLUMNS[idx]?.header ?? '',
    dataKey: col?.dataKey ?? DEFAULT_COLUMNS[idx]?.dataKey ?? `col${idx}`,
    align: col?.align ?? (idx === 0 ? 'left' : idx === columns.length - 1 ? 'right' : 'center'),
    cellWidth: col?.cellWidth,
  }));
}

function normalizeProvidedRows(rows, columnDefs) {
  return rows.map((row) =>
    columnDefs.map((col) => {
      const value = row?.[col.dataKey];
      if (value == null || value === '') return '—';
      return String(value);
    })
  );
}

function expandForFallback(cells, columnCount) {
  const out = new Array(columnCount).fill('');
  let cursor = 0;
  cells.forEach((cell) => {
    const span = Number(cell?.colSpan ?? 1) || 1;
    const text = cell && typeof cell === 'object' && !Array.isArray(cell)
      ? (cell.content == null ? '' : String(cell.content))
      : String(cell ?? '');
    for (let i = 0; i < span && cursor < columnCount; i += 1) {
      out[cursor] = text;
      cursor += 1;
    }
  });
  return out;
}

function extractRows() {
  if (!hasDOM || typeof document.querySelector !== 'function') return [];
  const table =
    document.querySelector('#compatibilityTable') ||
    document.querySelector('table.results-table.compat') ||
    document.querySelector('table');
  if (!table || typeof table.querySelectorAll !== 'function') return [];

  const rows = Array.from(table.querySelectorAll('tr')).filter((tr) => {
    const hasCells = typeof tr.querySelectorAll === 'function';
    if (!hasCells) return false;
    const tds = tr.querySelectorAll('td');
    const ths = tr.querySelectorAll('th');
    return tds.length > 0 && ths.length === 0;
  });

  return rows.map((tr) => {
    const cells = Array.from(tr.querySelectorAll('td')).map((td) =>
      String(td.textContent || '')
        .replace(/\s+/g, ' ')
        .replace(/([A-Za-z]+)\s*\1/, '$1')
        .trim()
    );

    let category = cells[0] || '—';
    if (/^cum$/i.test(category)) category = 'Cum Play';

    const toNum = (value) => {
      const numeric = Number(String(value ?? '').replace(/[^\d.-]/g, ''));
      return Number.isFinite(numeric) ? numeric : null;
    };

    const nums = cells.map(toNum).filter((n) => n !== null);

    if (nums.length === 0 && cells.slice(1).every((cell) => !cell)) {
      return { type: 'header', category };
    }

    const A = nums.length ? nums[0] : null;
    const B = nums.length > 1 ? nums[nums.length - 1] : null;

    let pct = cells.find((cell) => /%$/.test(cell)) || null;
    if (!pct && A != null && B != null) {
      const computed = Math.round(100 - (Math.abs(A - B) / 5) * 100);
      pct = `${Math.max(0, Math.min(100, computed))}%`;
    }

    return {
      type: 'row',
      category,
      A: A ?? '—',
      pct: pct ?? '—',
      B: B ?? '—',
    };
  });
}

function setButtonState(btn, ready) {
  if (!btn) return;
  const disable = !ready;
  if (typeof btn.toggleAttribute === 'function') {
    btn.toggleAttribute('disabled', disable);
  } else if (disable && typeof btn.setAttribute === 'function') {
    btn.setAttribute('disabled', 'disabled');
  } else if (!disable && typeof btn.removeAttribute === 'function') {
    btn.removeAttribute('disabled');
  }
  if (!ready && 'title' in btn) {
    try {
      btn.title = 'PDF export unavailable – no data yet.';
    } catch (_) {
      /* ignore */
    }
  }
}

function disablePdfButtons() {
  if (!hasDOM || typeof document.querySelectorAll !== 'function') return;
  document.querySelectorAll(BUTTON_SELECTOR).forEach((btn) => setButtonState(btn, false));
}

function getAutoTableInvoker(doc) {
  if (typeof doc.autoTable === 'function') {
    return (opts) => doc.autoTable(opts);
  }
  if (window.jspdf && typeof window.jspdf.autoTable === 'function') {
    return (opts) => window.jspdf.autoTable(doc, opts);
  }
  if (window.jsPDF && window.jsPDF.API && typeof window.jsPDF.API.autoTable === 'function') {
    return (opts) => window.jsPDF.API.autoTable.call(doc, opts);
  }
  throw new Error('AutoTable not available');
}

async function downloadCompatibilityPDF(options = {}) {
  const {
    filename = 'compatibility-report.pdf',
    orientation = 'landscape',
    format = 'a4',
    columns,
    rows,
  } = options;

  await ensurePdfLibs().catch((err) => {
    console.error(err);
  });

  const columnDefs = normalizeColumns(columns);
  const tableHead = [columnDefs.map((col) => col.header || '')];
  const columnStyles = {};
  columnDefs.forEach((col, idx) => {
    columnStyles[idx] = { halign: col.align };
    if (typeof col.cellWidth === 'number') {
      columnStyles[idx].cellWidth = col.cellWidth;
    }
  });

  let body = [];
  let fallbackBody = [];

  if (Array.isArray(rows) && rows.length > 0) {
    body = normalizeProvidedRows(rows, columnDefs);
    fallbackBody = body.map((row) => row.map((cell) => String(cell ?? '')));
    if (!body.length) {
      console.warn('[pdf] No data rows provided to export.');
      return;
    }
  } else {
    const extracted = extractRows();
    if (!extracted.length) {
      console.warn('[pdf] No data rows found to export.');
      disablePdfButtons();
      return;
    }

    extracted.forEach((entry) => {
      if (entry.type === 'header') {
        const headerCell = {
          content: entry.category,
          colSpan: columnDefs.length,
          styles: {
            fontStyle: 'bold',
            halign: 'left',
            fillColor: [0, 0, 0],
            textColor: [255, 255, 255],
          },
        };
        body.push([headerCell]);
        fallbackBody.push(expandForFallback([headerCell], columnDefs.length));
      } else {
        const row = [entry.category, entry.A, entry.pct, entry.B].map((cell) =>
          cell == null || cell === '' ? '—' : String(cell)
        );
        body.push(row);
        fallbackBody.push(row);
      }
    });
  }

  const JsPDF = getJsPDF();
  if (!JsPDF) {
    console.error('jsPDF failed to load.');
    return;
  }

  const doc = new JsPDF({ orientation, unit: 'pt', format });
  const pageW = doc.internal?.pageSize?.getWidth ? doc.internal.pageSize.getWidth() : 612;
  const pageH = doc.internal?.pageSize?.getHeight ? doc.internal.pageSize.getHeight() : 792;
  const bleed = 3;

  const paintBackground = () => {
    if (typeof doc.setFillColor === 'function') doc.setFillColor(0, 0, 0);
    if (typeof doc.rect === 'function') doc.rect(-bleed, -bleed, pageW + bleed * 2, pageH + bleed * 2, 'F');
    if (typeof doc.setTextColor === 'function') doc.setTextColor(255, 255, 255);
    if (typeof doc.setDrawColor === 'function') doc.setDrawColor(0, 0, 0);
    if (typeof doc.setLineWidth === 'function') doc.setLineWidth(0);
  };

  paintBackground();

  if (typeof doc.setFont === 'function') {
    try {
      doc.setFont('helvetica', 'normal');
    } catch (_) {
      /* ignore */
    }
  }

  const runAutoTable = getAutoTableInvoker(doc);
  const originalAddPage = typeof doc.addPage === 'function' ? doc.addPage.bind(doc) : null;
  if (originalAddPage) {
    doc.addPage = function patchedAddPage(...args) {
      const result = originalAddPage(...args);
      paintBackground();
      return result;
    };
  }

  try {
    runAutoTable({
      head: tableHead,
      body,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      startY: -bleed,
      startX: -bleed,
      tableWidth: pageW + bleed * 2,
      horizontalPageBreak: true,
      theme: 'plain',
      styles: {
        fontSize: 11,
        cellPadding: 8,
        textColor: [255, 255, 255],
        fillColor: null,
        lineColor: [0, 0, 0],
        lineWidth: 0,
        halign: 'center',
        valign: 'middle',
        overflow: 'linebreak',
        minCellHeight: 18,
      },
      headStyles: {
        fontStyle: 'bold',
        fillColor: null,
        textColor: [255, 255, 255],
        lineColor: [0, 0, 0],
        lineWidth: 0,
        cellPadding: 10,
      },
      columnStyles,
      tableLineColor: [0, 0, 0],
      tableLineWidth: 0,
      didAddPage: paintBackground,
      __fallbackHead: tableHead,
      __fallbackBody: fallbackBody,
    });
  } finally {
    if (originalAddPage) {
      doc.addPage = originalAddPage;
    }
  }

  if (typeof doc.save === 'function') {
    doc.save(filename);
  }
}

function bindPdfButton() {
  if (!hasDOM || typeof document.querySelectorAll !== 'function') return;
  const buttons = document.querySelectorAll(BUTTON_SELECTOR);
  buttons.forEach((btn) => {
    if (!btn || btn.__tkPdfBound) return;
    btn.__tkPdfBound = true;
    if (typeof btn.addEventListener === 'function') {
      btn.addEventListener('click', (event) => {
        if (event?.preventDefault) event.preventDefault();
        downloadCompatibilityPDF();
      });
    }
  });
}

if (typeof window !== 'undefined') {
  window.downloadCompatibilityPDF = downloadCompatibilityPDF;
  window.tkMakeCompatibilityPDF = downloadCompatibilityPDF;
  window.bindPdfButton = bindPdfButton;

  if (hasDOM) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', bindPdfButton, { once: true });
    } else {
      bindPdfButton();
    }
  }
}

export { downloadCompatibilityPDF, bindPdfButton };
