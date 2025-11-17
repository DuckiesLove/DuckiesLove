/**
 * TalkKink Compatibility PDF (Dark, Web-Only)
 * - Single layout: Item | Partner A | Match | Partner B
 * - Match column shows percentage + emoji (⭐ / 🚩)
 * - ⭐ for 85–100%, 🚩 for 0–30%, nothing between
 * - Category headers between sections
 * - Footer summary with averages + counts
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

  function safeString(val) {
    if (val == null) return "";
    const s = String(val).trim();
    return s === "null" || s === "undefined" ? "" : s;
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

  // ⭐ for 85–100%, 🚩 for 0–30%, nothing in between
  function getMatchEmoji(aScore, bScore, matchPercent) {
    if (!Number.isFinite(matchPercent)) return "";

    if (matchPercent >= 85) return "⭐";
    if (matchPercent <= 30) return "🚩";

    return "";
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
      matchText: matchPercent != null ? `${matchPercent}%` : safeString(matchRaw),
    };
  }

  function computeSummaryStats(rows) {
    let answered = 0;
    let sum = 0;
    let stars = 0;
    let reds = 0;

    rows.forEach((r) => {
      if (!Number.isFinite(r.matchPercent)) return;
      answered += 1;
      sum += r.matchPercent;
      const emoji = getMatchEmoji(r.aScore, r.bScore, r.matchPercent);
      if (emoji === "⭐") stars += 1;
      else if (emoji === "🚩") reds += 1;
    });

    const avg = answered ? Math.round(sum / answered) : null;
    return { totalRows: rows.length, answered, avg, stars, reds };
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

      const emoji = getMatchEmoji(r.aScore, r.bScore, r.matchPercent);
      const matchText =
        r.matchPercent != null
          ? `${r.matchPercent}%${emoji ? " " + emoji : ""}`
          : safeString(r.matchText);

      rows.push({
        item: r.item,
        a: r.aText,
        match: matchText,
        b: r.bText,
        _isGroupHeader: false,
        _source: r,
      });
    });

    return rows;
  }

  /* ----------------------------- Drawing -------------------------------- */

  function drawHeader(doc, mainTitle, sectionTitle) {
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();

    doc.setFillColor(BG[0], BG[1], BG[2]);
    doc.rect(0, 0, pageW, pageH, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(40);
    const tW = doc.getTextWidth(mainTitle);
    doc.text(mainTitle, (pageW - tW) / 2, 80);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    const stamp = `Generated: ${new Date().toLocaleString()}`;
    const sW = doc.getTextWidth(stamp);
    doc.text(stamp, (pageW - sW) / 2, 108);

    doc.setDrawColor(ACCENT[0], ACCENT[1], ACCENT[2]);
    doc.setLineWidth(2.5);
    const pad = 80;
    doc.line(pad, 122, pageW - pad, 122);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(28);
    const hW = doc.getTextWidth(sectionTitle);
    doc.text(sectionTitle, (pageW - hW) / 2, 170);

    return 190;
  }

  function drawSummaryFooter(doc, stats, startY) {
    const pageW = doc.internal.pageSize.getWidth();
    let y = startY + 18;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(220, 220, 220);

    const parts = [];

    if (stats.avg != null) {
      parts.push(`Average compatibility: ${stats.avg}%`);
    }

    parts.push(`⭐ 85–100% matches: ${stats.stars}`);
    parts.push(`🚩 30% or below: ${stats.reds}`);

    const text = parts.join("   •   ");
    const tW = doc.getTextWidth(text);
    doc.text(text, (pageW - tW) / 2, y);

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

    const headerY = drawHeader(doc, mainTitle, sectionTitle);
    const bodyRows = buildBodyRows(normRows);
    const stats = computeSummaryStats(normRows);

    const columns = [
      { header: "Item", dataKey: "item" },
      { header: "Partner A", dataKey: "a" },
      { header: "Match", dataKey: "match" },
      { header: "Partner B", dataKey: "b" },
    ];

    doc.autoTable({
      columns,
      body: bodyRows,
      startY: headerY,
      margin: { left: 70, right: 70 },
      theme: "grid",
      styles: {
        font: "helvetica",
        fontSize: 12,
        halign: "left",
        valign: "middle",
        cellPadding: { top: 5, bottom: 5, left: 6, right: 6 },
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
        item: { cellWidth: 320, halign: "left" },
        a: { cellWidth: 70, halign: "center" },
        match: { cellWidth: 90, halign: "center" },
        b: { cellWidth: 70, halign: "center" },
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
            data.cell.colSpan = 4;
          } else {
            data.cell.text = [];
          }
        }
      },
    });

    const finalY =
      (doc.lastAutoTable && doc.lastAutoTable.finalY) || headerY + 40;
    drawSummaryFooter(doc, stats, finalY);
  }

  async function generateCompatibilityPDF(rawRows) {
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

  async function generateFromStorage() {
    let rows = getRowsFromWindow();
    if (!rows.length) rows = getRowsFromStorage();
    if (!rows.length) {
      alert(
        "Upload both partner surveys first, then wait for the green messages below the buttons before downloading."
      );
      throw new Error("No rows available for PDF");
    }

    cacheRows(rows);
    await generateCompatibilityPDF(rows);
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
        await generateFromStorage();
      } catch (err) {
        console.error("[compat-pdf] PDF generation failed", err);
      }
    });
  }

  /* --------------------------- Global API -------------------------------- */

  window.TKCompatPDF = {
    async generateFromStorage() {
      await ensurePdfLibs();
      return generateFromStorage();
    },
    async download(rows) {
      await ensurePdfLibs();
      if (Array.isArray(rows) && rows.length) {
        cacheRows(rows);
        return generateCompatibilityPDF(rows);
      }
      return generateFromStorage();
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
