/* -------------------------------------------------------------------------
 * TalkKink — Compatibility PDF (Web-only, NO Flag column)
 * File: js/compatibilityPdf.js
 *
 * - Uses talkkinkCompatRows / localStorage cache for data
 * - Produces a single dark PDF:
 *      Item | Partner A | Match | Partner B
 * - No "Flag" column at all
 * - Replaces any existing click handlers on the download button
 * ---------------------------------------------------------------------- */

(function () {
  const BTN_SELECTOR = '#downloadPdfBtn, #downloadBtn, [data-download-pdf]';

  // ---------- Helpers ----------
  function safeString(val) {
    if (val == null) return '';
    const s = String(val).trim();
    return (s === 'null' || s === 'undefined') ? '' : s;
  }

  function coerceScore(val) {
    if (val == null || (typeof val === 'string' && !val.trim())) return null;
    if (typeof val === 'number' && Number.isFinite(val)) return val;
    const parsed = Number(String(val).replace(/[^0-9.-]/g, ''));
    return Number.isFinite(parsed) ? parsed : null;
  }

  function clampPercent(v) {
    if (!Number.isFinite(v)) return null;
    return Math.max(0, Math.min(100, v));
  }

  function computeMatchPercent(rawMatch, aScore, bScore) {
    const direct = clampPercent(coerceScore(rawMatch));
    if (direct != null) return Math.round(direct);
    if (Number.isFinite(aScore) && Number.isFinite(bScore)) {
      const pct = 100 - (Math.abs(aScore - bScore) / 5) * 100;
      return Math.round(Math.max(0, Math.min(100, pct)));
    }
    return null;
  }

  function getCompatRows() {
    // Prefer the live in-memory rows from the comparison page
    if (Array.isArray(window.talkkinkCompatRows) && window.talkkinkCompatRows.length) {
      return window.talkkinkCompatRows.slice();
    }

    // Fallback: cached rows from localStorage
    try {
      const raw = localStorage.getItem('talkkink:compatRows');
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.warn('[simple-compat-pdf] could not read cached rows', e);
      return [];
    }
  }

  function normalizeRow(row) {
    let item, aRaw, bRaw, matchRaw;

    if (Array.isArray(row)) {
      // Old shape: [item, a, match, flag, b]
      [item, aRaw, matchRaw, , bRaw] = row;
    } else if (row && typeof row === 'object') {
      item = row.item ?? row.label ?? row.category ?? '';
      aRaw = row.a ?? row.partnerA ?? row.aScore ?? row.scoreA;
      bRaw = row.b ?? row.partnerB ?? row.bScore ?? row.scoreB;
      matchRaw =
        row.matchPercent ??
        row.matchPct ??
        row.match ??
        row.matchText ??
        row.matchValue ??
        '';
    }

    const aScore = coerceScore(aRaw);
    const bScore = coerceScore(bRaw);
    const matchPercent = computeMatchPercent(matchRaw, aScore, bScore);

    return {
      item: safeString(item),
      a: aScore != null ? String(aScore) : safeString(aRaw),
      b: bScore != null ? String(bScore) : safeString(bRaw),
      match: matchPercent != null ? `${matchPercent}%` : safeString(matchRaw),
    };
  }

  function getJsPDF() {
    return (window.jspdf && window.jspdf.jsPDF) || window.jsPDF || null;
  }

  function hasAutoTable(jsPDF) {
    const api =
      (jsPDF && jsPDF.API && (jsPDF.API.autoTable || jsPDF.API.__autoTable__)) ||
      (window.jspdf && window.jspdf.autoTable);
    return !!api;
  }

  // ---------- Core generator ----------
  async function generateCompatibilityPDF() {
    const jsPDF = getJsPDF();
    if (!jsPDF || !hasAutoTable(jsPDF)) {
      alert('PDF libraries are not ready yet. Try again in a moment.');
      return;
    }

    const rawRows = getCompatRows();
    if (!rawRows.length) {
      alert('Upload both surveys and view the comparison before downloading the PDF.');
      return;
    }

    const rows = rawRows.map(normalizeRow).filter(r => r.item || r.a || r.b || r.match);

    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();

    // Background
    doc.setFillColor(18, 19, 20);
    doc.rect(0, 0, pageW, pageH, 'F');
    doc.setTextColor(255, 255, 255);

    // Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(36);
    const title = 'Talk Kink Compatibility Survey';
    const tW = doc.getTextWidth(title);
    doc.text(title, (pageW - tW) / 2, 80);

    // Generated timestamp
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    const subtitle = 'Generated: ' + new Date().toLocaleString();
    const sW = doc.getTextWidth(subtitle);
    doc.text(subtitle, (pageW - sW) / 2, 104);

    // Accent line
    doc.setDrawColor(0, 214, 199);
    doc.setLineWidth(2.5);
    const pad = 84;
    doc.line(pad, 118, pageW - pad, 118);

    // Section header (you can change this label if you want)
    const headerY = 118 + 36;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(24);
    const sectionTitle = 'Behavioral Play';
    const secW = doc.getTextWidth(sectionTitle);
    doc.text(sectionTitle, (pageW - secW) / 2, headerY);

    // Table — 4 columns only (NO Flag)
    const body = rows.map(r => [r.item, r.a, r.match, r.b]);

    doc.autoTable({
      startY: headerY + 24,
      head: [['Item', 'Partner A', 'Match', 'Partner B']],
      body,
      margin: { left: 60, right: 60 },
      theme: 'grid',
      styles: {
        font: 'helvetica',
        fontSize: 12,
        halign: 'left',
        valign: 'middle',
        minCellHeight: 20,
        cellPadding: { top: 5, bottom: 5, left: 6, right: 6 },
        textColor: [230, 230, 230],
        fillColor: [25, 25, 28],
        lineColor: [40, 40, 45],
        lineWidth: 1.2,
      },
      headStyles: {
        fontStyle: 'bold',
        textColor: [0, 255, 245],
        fillColor: [28, 28, 32],
        lineColor: [40, 40, 45],
        lineWidth: 1.4,
        halign: 'center',
      },
      // Widths chosen so total fits page (no "16 units could not fit page" error)
      columnStyles: {
        0: { cellWidth: 360, halign: 'left' },  // Item
        1: { cellWidth: 80, halign: 'center' }, // Partner A
        2: { cellWidth: 80, halign: 'center' }, // Match
        3: { cellWidth: 80, halign: 'center' }, // Partner B
      },
      overflow: 'linebreak',
    });

    doc.save('talkkink-compatibility.pdf');
  }

  // ---------- Button wiring: replace old PDF handlers ----------
  function wireButton() {
    const btn = document.querySelector(BTN_SELECTOR);
    if (!btn) {
      console.warn('[simple-compat-pdf] Download button not found');
      return;
    }

    // Strip inline onclick / old listeners by cloning
    const clone = btn.cloneNode(true);
    btn.parentNode.replaceChild(clone, btn);

    clone.disabled = false;
    clone.title = 'Download your compatibility PDF';

    clone.addEventListener('click', function (e) {
      e.preventDefault();
      generateCompatibilityPDF();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wireButton, { once: true });
  } else {
    wireButton();
  }
})();
