/**
 * TalkKink Compatibility PDF (Dark, Web-Only)
 * - Single layout: Item | Partner A | Match | Partner B (no Flag column)
 * - Match column shows percentage with ⭐ for 85%+
 * - Category headers between sections
 * - Footer summary with averages + star counts
 */

(function () {
  const SCRIPT_SOURCES = {
    JSPDF: [
      "/assets/js/vendor/jspdf.umd.min.js",
      "/js/vendor/jspdf.umd.min.js",
      "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
    ],
    AUTOTABLE: [
      "/assets/js/vendor/jspdf.plugin.autotable.min.js",
      "/js/vendor/jspdf.plugin.autotable.min.js",
      "https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js",
    ],
  };

  const STORAGE_KEY = "talkkink:compatRows";
  const DL_SELECTOR = "#downloadPdfBtn, #downloadBtn, [data-download-pdf]";

  const ACCENT = [0, 214, 199];
  const BG = [15, 16, 18];
  const TABLE_BG = [26, 27, 31];
  const ALT_ROW_BG = [19, 20, 24];
  const GRID = [40, 40, 45];
  const TEXT_MAIN = [235, 235, 235];
  const HEADER_TEXT = [0, 255, 245];

  let libsPromise = null;

  /* --------------------------- Utility Helpers --------------------------- */

  const LOADED_LIBS = new Set();

  function injectScript(src, dataKey) {
    return new Promise((resolve, reject) => {
      const key = dataKey || src;
      if (key && LOADED_LIBS.has(key)) {
        resolve();
        return;
      }

      const s = document.createElement("script");
      s.src = src;
      s.defer = true;
      s.crossOrigin = "anonymous";
      s.referrerPolicy = "no-referrer";
      if (dataKey) s.dataset.lib = dataKey;

      s.onload = () => {
        if (key) LOADED_LIBS.add(key);
        resolve();
      };
      s.onerror = () => {
        s.remove();
        reject(new Error(`Failed to load ${src}`));
      };
      document.head.appendChild(s);
    });
  }

  async function loadScriptFromSources(sources, dataKey) {
    let lastError = null;
    for (const src of sources) {
      try {
        await injectScript(src, dataKey);
        return;
      } catch (err) {
        lastError = err;
        console.warn(`[compat-pdf] Failed to load ${dataKey || "script"} from ${src}`, err);
      }
    }
    if (lastError) throw lastError;
    throw new Error(`Unable to load ${dataKey || "script"}`);
  }

  function hasJsPDF() {
    return !!(window.jspdf && window.jspdf.jsPDF) || !!window.jsPDF;
  }

  function hasAutoTable() {
    const ctor = window.jspdf && window.jspdf.jsPDF;
    const legacy = window.jsPDF;
    const api =
      (ctor && ctor.API) || (legacy && legacy.API) || (window.jspdf && window.jspdf.API);
    return !!(api && (api.autoTable || api.__autoTable__));
  }

  async function ensurePdfLibs() {
    if (libsPromise) return libsPromise;

    libsPromise = (async () => {
      if (!hasJsPDF()) {
        await loadScriptFromSources(SCRIPT_SOURCES.JSPDF, "jspdf");
      }

      // Bridge UMD -> legacy
      if (!window.jsPDF && window.jspdf && window.jspdf.jsPDF) {
        window.jsPDF = window.jspdf.jsPDF;
      }

      if (!hasAutoTable()) {
        await loadScriptFromSources(SCRIPT_SOURCES.AUTOTABLE, "jspdf-autotable");
      }

      const ctor = window.jspdf && window.jspdf.jsPDF;
      const legacy = window.jsPDF;
      const api =
        (legacy && legacy.API && (legacy.API.autoTable || legacy.API.__autoTable__)) ||
        (ctor && ctor.API && (ctor.API.autoTable || ctor.API.__autoTable__));

      if (api) {
        if (ctor) {
          ctor.API = ctor.API || {};
          ctor.API.autoTable = api;
        }
        if (legacy) {
          legacy.API = legacy.API || {};
          legacy.API.autoTable = api;
        }
      }

      if (!hasJsPDF()) throw new Error("jsPDF not available after CDN load");
      if (!hasAutoTable())
        throw new Error("jsPDF-AutoTable not available after CDN load");

      return window.jspdf ? window.jspdf.jsPDF : window.jsPDF;
    })();

    return libsPromise;
  }

  function cleanArtifacts(text) {
    if (typeof text !== "string") return text;
    return text.replace(/&{2,}/g, "&");
  }

  function safeString(val) {
    if (val == null) return "";
    const s = String(val).trim();
    if (s === "null" || s === "undefined") return "";
    return cleanArtifacts(s);
  }

  function coerceScore(val) {
    if (val == null || (typeof val === "string" && !val.trim())) return null;
    if (typeof val === "number" && Number.isFinite(val)) return val;
    const parsed = Number(String(val).replace(/[^0-9.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }

  function clampPercent(v) {
    if (!Number.isFinite(v)) return null;
    return Math.max(0, Math.min(100, v));
  }

  function computeMatchPercent(rawMatch, aScore, bScore) {
    // 1) If we already have a percentage, trust that
    const direct = clampPercent(coerceScore(rawMatch));
    if (direct != null) return Math.round(direct);

    // 2) Otherwise derive from A/B scores (5-point scale)
    if (Number.isFinite(aScore) && Number.isFinite(bScore)) {
      const diff = Math.abs(aScore - bScore);
      const pct = 100 - (diff / 5) * 100;
      return Math.round(Math.max(0, Math.min(100, pct)));
    }

    return null;
  }

  function deriveSectionTitle(rawRows) {
    if (!rawRows || !rawRows.length) return "Compatibility Survey";
    const r0 = rawRows[0] || {};
    const candidates = [
      r0.sectionTitle,
      r0.kinkArea,
      r0.area,
      r0.kink,
      r0.category,
      r0.group,
      r0.title,
    ];
    for (const c of candidates) {
      if (c && typeof c === "string") return c;
    }
    return "Compatibility Survey";
  }

  function deriveRowCategory(raw, itemLabel) {
    // Prefer explicit properties from glue/rows
    const candidates = [
      raw.section,
      raw.category,
      raw.group,
      raw.subCategory,
      raw.kinkCategory,
    ];
    for (const c of candidates) {
      if (c && typeof c === "string") return c;
    }

    // Fallback: text in parentheses at end of item, e.g. "(Body Part Torture)"
    const label = safeString(itemLabel);
    const m = label.match(/\(([^)]+)\)\s*$/);
    if (m) return m[1];

    return "";
  }

  function getMatchEmoji(matchPercent) {
    if (!Number.isFinite(matchPercent)) return "";
    return matchPercent >= 85 ? "⭐" : "";
  }

  function formatMatchWithEmoji(aScore, bScore, matchPercent) {
    if (!Number.isFinite(matchPercent)) return "";
    const emoji = getMatchEmoji(matchPercent);
    return `${matchPercent}%${emoji ? ` ${emoji}` : ""}`;
  }

  function normalizeCompatRow(raw) {
    if (!raw) return null;

    let item;
    let aRaw;
    let bRaw;
    let matchRaw;

    if (Array.isArray(raw)) {
      // Legacy [item, A, match, <flag>, B]
      [item, aRaw, matchRaw, , bRaw] = raw;
    } else if (typeof raw === "object") {
      item = raw.item || raw.label || raw.name || "";
      aRaw = raw.a ?? raw.partnerA ?? raw.aScore ?? raw.scoreA;
      bRaw = raw.b ?? raw.partnerB ?? raw.bScore ?? raw.scoreB;
      matchRaw =
        raw.matchPercent ??
        raw.matchPct ??
        raw.match ??
        raw.matchText ??
        raw.matchValue ??
        "";
    }

    const aScore = coerceScore(aRaw);
    const bScore = coerceScore(bRaw);
    const matchPercent = computeMatchPercent(matchRaw, aScore, bScore);

    const cat = deriveRowCategory(raw, item);

    return {
      raw,
      section: safeString(cat),
      item: safeString(item),
      aScore,
      bScore,
      matchPercent,
      aText: aScore != null ? String(aScore) : safeString(aRaw),
      bText: bScore != null ? String(bScore) : safeString(bRaw),
      matchPercentStr: matchPercent != null ? `${matchPercent}%` : safeString(matchRaw),
      matchText: matchPercent != null ? `${matchPercent}%` : safeString(matchRaw),
    };
  }

  function computeSummaryStats(rows) {
    let answered = 0;
    let sum = 0;
    let stars = 0;
    rows.forEach((r) => {
      if (!Number.isFinite(r.matchPercent)) return;
      answered += 1;
      sum += r.matchPercent;
      const star = getMatchEmoji(r.matchPercent);
      if (star) stars += 1;
    });

    const avg = answered ? Math.round(sum / answered) : null;
    return { totalRows: rows.length, answered, avg, stars };
  }

  function buildBodyRows(normRows) {
    const rows = [];
    let currentSection = null;

    // Stable group + sort by section then item
    const sorted = normRows.slice().sort((a, b) => {
      const sa = a.section || "";
      const sb = b.section || "";
      if (sa !== sb) return sa.localeCompare(sb);
      return a.item.localeCompare(b.item);
    });

    sorted.forEach((r) => {
      const sec = r.section || "";
      if (sec && sec !== currentSection) {
        currentSection = sec;
        rows.push({
          item: sec,
          a: "",
          match: "",
          b: "",
          _isGroupHeader: true,
        });
      }

      const matchBase =
        r.matchPercent != null
          ? formatMatchWithEmoji(r.aScore, r.bScore, r.matchPercent)
          : r.matchPercentStr || safeString(r.matchText);

      rows.push({
        item: r.item,
        a: r.aText,
        match: matchBase,
        b: r.bText,
        _isGroupHeader: false,
        _source: r,
      });
    });

    return rows;
  }

  /* ----------------------------- Drawing -------------------------------- */

  function measureTextWidth(doc, text) {
    if (!doc) return 0;
    if (typeof doc.getTextWidth === "function") {
      try {
        return doc.getTextWidth(text);
      } catch (err) {
        /* ignore and fall through */
      }
    }

    if (typeof doc.getTextDimensions === "function") {
      try {
        const dims = doc.getTextDimensions(text || "");
        if (dims && Number.isFinite(dims.w)) return dims.w;
      } catch (err) {
        /* ignore and fall through */
      }
    }

    if (
      typeof doc.getStringUnitWidth === "function" &&
      typeof doc.getFontSize === "function"
    ) {
      try {
        const units = doc.getStringUnitWidth(text || "");
        const fontSize = doc.getFontSize();
        if (Number.isFinite(units) && Number.isFinite(fontSize)) {
          return units * fontSize;
        }
      } catch (err) {
        /* ignore and fall through */
      }
    }

    const str = text == null ? "" : String(text);
    return str.length * 6;
  }

  function computeTableLayout(doc) {
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = Math.max(36, Math.min(70, Math.round(pageWidth * 0.1)));
    const available = pageWidth - margin * 2;
    const minWidths = { item: 220, a: 70, match: 110, b: 70 };
    const weights = { item: 0.54, a: 0.16, match: 0.2, b: 0.1 };
    const widths = { item: 0, a: 0, match: 0, b: 0 };

    let total = 0;
    Object.keys(widths).forEach((key) => {
      const raw = Math.round(available * (weights[key] || 0));
      widths[key] = Math.max(raw, minWidths[key]);
      total += widths[key];
    });

    const reduceOrder = ["item", "match", "a", "b"];
    const growOrder = ["item", "match", "a", "b"];

    function shrinkToFit(target) {
      let guard = 0;
      while (total > target && guard < 4096) {
        let changed = false;
        for (const key of reduceOrder) {
          if (total <= target) break;
          if (widths[key] > minWidths[key]) {
            widths[key] -= 1;
            total -= 1;
            changed = true;
          }
        }
        if (!changed) break;
        guard += 1;
      }
    }

    function growToFit(target) {
      let guard = 0;
      while (total < target && guard < 4096) {
        for (const key of growOrder) {
          if (total >= target) break;
          widths[key] += 1;
          total += 1;
        }
        guard += 1;
      }
    }

    if (total > available) {
      shrinkToFit(available);
    } else if (total < available) {
      growToFit(available);
    }

    const tableWidth = widths.item + widths.a + widths.match + widths.b;
    const centerX = margin + tableWidth / 2;

    return { margin, widths, tableWidth, centerX };
  }

  function drawPolygon(doc, points, style) {
    if (!doc || typeof doc.lines !== "function") return;
    if (!Array.isArray(points) || points.length < 2) return;
    const segments = [];
    for (let i = 1; i < points.length; i += 1) {
      segments.push([points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]]);
    }
    doc.lines(segments, points[0][0], points[0][1], [1, 1], style || "F", true);
  }

  function drawStarShape(doc, frame) {
    if (!frame) return;
    const size = Math.max(frame.size || 0, 6);
    const cx = frame.x + size / 2;
    const cy = frame.y + size / 2;
    const outer = size / 2;
    const inner = outer * 0.5;
    const pts = [];
    for (let i = 0; i < 5; i += 1) {
      const outerAngle = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
      const innerAngle = outerAngle + Math.PI / 5;
      pts.push([cx + Math.cos(outerAngle) * outer, cy + Math.sin(outerAngle) * outer]);
      pts.push([cx + Math.cos(innerAngle) * inner, cy + Math.sin(innerAngle) * inner]);
    }
    if (typeof doc.saveGraphicsState === "function") doc.saveGraphicsState();
    doc.setFillColor(255, 213, 79);
    doc.setDrawColor(230, 170, 0);
    doc.setLineWidth(0.8);
    drawPolygon(doc, pts, "FD");
    if (typeof doc.restoreGraphicsState === "function") doc.restoreGraphicsState();
  }

  function drawMatchIcon(doc, cell, icon, options) {
    if (!doc || !cell || !icon) return;
    const opts = options || {};
    const rawHeight = cell.height || opts.size || 12;
    const rawWidth = cell.width || opts.size || rawHeight;
    const maxSize = typeof opts.size === "number" ? opts.size : 14;
    const iconSize = Math.min(maxSize, Math.max(8, Math.min(rawHeight, rawWidth)));
    const padding = typeof opts.padding === "number" ? opts.padding : 4;
    const alignLeft = opts.align === "left";
    const x = alignLeft
      ? cell.x + padding
      : cell.x + rawWidth - iconSize - padding;
    const y = cell.y + (rawHeight - iconSize) / 2;
    const frame = { x, y, size: iconSize };

    if (icon === "⭐") {
      drawStarShape(doc, frame);
    }
  }

  function drawHeader(doc, mainTitle, sectionTitle, options) {
    const opts = options || {};
    const stampText = typeof opts.timestamp === "string" && opts.timestamp
      ? opts.timestamp
      : `Generated: ${new Date().toLocaleString()}`;
    const fillBackground = opts.fillBackground !== false;
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const centerX = Number.isFinite(opts.centerX) ? opts.centerX : pageW / 2;

    if (fillBackground) {
      doc.setFillColor(BG[0], BG[1], BG[2]);
      doc.rect(0, 0, pageW, pageH, "F");
    }

    const titleBoxWidth = Math.min(520, pageW * 0.75);
    const titleBoxX = centerX - titleBoxWidth / 2;
    const titleBoxY = 26;
    const titleBoxHeight = 42;

    if (typeof doc.roundedRect === "function") {
      doc.setFillColor(18, 27, 36);
      doc.setDrawColor(ACCENT[0], ACCENT[1], ACCENT[2]);
      doc.setLineWidth(1.4);
      doc.roundedRect(titleBoxX, titleBoxY - 18, titleBoxWidth, titleBoxHeight, 8, 8, "FD");
    }

    doc.setFont("helvetica", "bold");
    doc.setTextColor(ACCENT[0], ACCENT[1], ACCENT[2]);
    doc.setFontSize(24);
    doc.text(mainTitle || "TalkKink Compatibility", centerX, 36, { align: "center" });

    doc.setFontSize(12);
    doc.setTextColor(230, 234, 240);
    doc.setFont("helvetica", "normal");
    doc.text(stampText, centerX, 56, { align: "center" });

    doc.setDrawColor(ACCENT[0], ACCENT[1], ACCENT[2]);
    doc.setLineWidth(4.5);
    const pad = 80;
    const glowY = 74;
    doc.line(pad, glowY, pageW - pad, glowY);
    doc.setLineWidth(1.3);
    doc.setDrawColor(0, 130, 150);
    doc.line(pad, glowY + 6, pageW - pad, glowY + 6);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(ACCENT[0], ACCENT[1], ACCENT[2]);
    doc.text(sectionTitle, centerX, 98, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.setTextColor(255, 255, 255);

    return 126;
  }

  function drawSummaryFooter(doc, stats, startY) {
    const pageW = doc.internal.pageSize.getWidth();
    let y = startY + 18;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(220, 220, 220);

    const segments = [];
    if (stats.avg != null) {
      segments.push({ text: `Average compatibility: ${stats.avg}%` });
    }
    segments.push({ icon: "⭐", text: `85–100% matches: ${stats.stars}` });

    const spacer = "   •   ";
    let printable = "";
    const placeholders = [];
    segments.forEach((seg, idx) => {
      if (!seg || !seg.text) return;
      if (idx > 0) printable += spacer;
      if (seg.icon) {
        const markerIndex = printable.length;
        placeholders.push({ icon: seg.icon, index: markerIndex });
        printable += "  ";
      }
      printable += seg.text;
    });

    const textWidth = measureTextWidth(doc, printable);
    const startX = (pageW - textWidth) / 2;
    doc.text(printable, startX, y);

    const iconSize = 12;
    placeholders.forEach((ph) => {
      if (!ph || !ph.icon) return;
      const prefix = printable.slice(0, ph.index);
      const offset = measureTextWidth(doc, prefix);
      drawMatchIcon(
        doc,
        { x: startX + offset, y: y - iconSize + 3, width: iconSize, height: iconSize },
        ph.icon,
        { align: "left", padding: 0, size: iconSize },
      );
    });

    y += 12;
    return y;
  }

  function renderDarkPdf(doc, rawRows) {
    const normRows = rawRows
      .map(normalizeCompatRow)
      .filter((r) => r && (r.item || r.aText || r.bText));

    if (!normRows.length) {
      throw new Error("No compatibility rows available");
    }

    const sectionTitle = deriveSectionTitle(rawRows);
    const mainTitle = "TalkKink Compatibility Survey";

    const layout = computeTableLayout(doc);
    const headerStamp = `Generated: ${new Date().toLocaleString()}`;
    const headerY = drawHeader(doc, mainTitle, sectionTitle, {
      timestamp: headerStamp,
      centerX: layout.centerX,
    });
    const bodyRows = buildBodyRows(normRows);
    const stats = computeSummaryStats(normRows);

    const columns = [
      { header: "Item", dataKey: "item" },
      { header: "Partner A", dataKey: "a" },
      { header: "Match %", dataKey: "match" },
      { header: "Partner B", dataKey: "b" },
    ];

    doc.autoTable({
      columns,
      body: bodyRows,
      startY: headerY,
      margin: { left: layout.margin, right: layout.margin },
      theme: "grid",
      styles: {
        font: "helvetica",
        fontSize: 12,
        halign: "center",
        valign: "middle",
        cellPadding: { top: 5, bottom: 5, left: 6, right: 8 },
        textColor: TEXT_MAIN,
        fillColor: TABLE_BG,
        lineColor: GRID,
        lineWidth: 0.9,
        overflow: "linebreak", // inside styles, not root (no deprecation warning)
      },
      headStyles: {
        fontStyle: "bold",
        textColor: HEADER_TEXT,
        fillColor: [30, 32, 36],
        lineColor: GRID,
        lineWidth: 1.2,
        halign: "center",
      },
      alternateRowStyles: {
        fillColor: ALT_ROW_BG,
      },
      columnStyles: {
        item: { cellWidth: layout.widths.item, halign: "left" },
        a: { cellWidth: layout.widths.a, halign: "center" },
        match: {
          cellWidth: layout.widths.match,
          halign: "center",
          cellPadding: { top: 5, bottom: 5, left: 6, right: 6 },
        },
        b: { cellWidth: layout.widths.b, halign: "center" },
      },
      didParseCell: function (data) {
        if (data.section !== "body") return;
        const raw = data.row.raw || {};
        if (raw._isGroupHeader) {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fillColor = [24, 25, 30];
          data.cell.styles.textColor = HEADER_TEXT;
          data.cell.styles.halign = "left";

          if (data.column.dataKey === "item") {
            data.cell.colSpan = columns.length;
          } else {
            data.cell.text = [];
          }
        }
      },
      didDrawPage: function () {
        drawHeader(doc, mainTitle, sectionTitle, {
          timestamp: headerStamp,
          centerX: layout.centerX,
        });
      },
    });

    const finalY =
      (doc.lastAutoTable && doc.lastAutoTable.finalY) || headerY + 40;
    drawSummaryFooter(doc, stats, finalY);
  }

  async function tkGenerateCompatPdf(rawRows) {
    const jsPDFCtor = await ensurePdfLibs();
    const doc = new jsPDFCtor({
      orientation: "landscape",
      unit: "pt",
      format: "letter",
    });

    renderDarkPdf(doc, rawRows);
    doc.save("compatibility-pretty-dark.pdf");
  }

  /* -------------------------- Rows + Storage ----------------------------- */

  function getRowsFromWindow() {
    if (Array.isArray(window.talkkinkCompatRows)) {
      return window.talkkinkCompatRows.slice();
    }
    return [];
  }

  function getRowsFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      console.warn("[compat-pdf] Failed to read rows from storage", err);
      return [];
    }
  }

  function cacheRows(rows) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(rows || []));
    } catch (err) {
      console.warn("[compat-pdf] Failed to cache rows", err);
    }
  }

  /* ---------------------------- Download UX ------------------------------ */

  async function generateFromStorageInternal() {
    let rows = getRowsFromWindow();
    if (!rows.length) rows = getRowsFromStorage();
    if (!rows.length) {
      alert(
        "Upload both partner surveys first, then wait for the green messages below the buttons before downloading."
      );
      throw new Error("No rows available for PDF");
    }

    cacheRows(rows);
    await tkGenerateCompatPdf(rows);
  }

  function attachDownloadOverride() {
    const btn = document.querySelector(DL_SELECTOR);
    if (!btn) return;

    console.info(
      "[compat-override] Download button now uses TKCompatPDF.generateFromStorage() only (no legacy Flag column PDF)."
    );

    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      try {
        await generateFromStorageInternal();
      } catch (err) {
        console.error("[compat-pdf] PDF generation failed", err);
      }
    });
  }

  /* --------------------------- Global API -------------------------------- */

  window.TKCompatPDF = {
    async generateFromStorage() {
      await ensurePdfLibs();
      return generateFromStorageInternal();
    },
    async download(rows) {
      await ensurePdfLibs();
      if (Array.isArray(rows) && rows.length) {
        cacheRows(rows);
        return tkGenerateCompatPdf(rows);
      }
      return generateFromStorageInternal();
    },
    notifyRowsUpdated(rows) {
      if (Array.isArray(rows)) {
        window.talkkinkCompatRows = rows.slice();
        cacheRows(rows);
      }
    },
    ensureLibs: ensurePdfLibs,
  };

  /* --------------------------- Init on Load ------------------------------ */

  function init() {
    console.info("[compat] kill-switch disabled (TKCompatPDF active)");
    attachDownloadOverride();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
