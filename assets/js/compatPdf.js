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

  const ACCENT = [16, 226, 240];
  const BG = [5, 19, 26];
  const TABLE_BG = [10, 23, 32];
  const ALT_ROW_BG = [11, 17, 23];
  const GRID = [30, 50, 56];
  const TEXT_MAIN = [232, 247, 251];
  const HEADER_TEXT = [183, 255, 255];
  const DEFAULT_FONT_FAMILY = "SpaceGrotesk";
  const FALLBACK_FONT_FAMILY = "Inter";

  const SECTION_PANEL = [10, 29, 38];
  const HEADER_PANEL = [11, 23, 31];
  const COLUMN_FILLS = {
    item: [10, 23, 32],
    a: [6, 38, 45],
    match: [8, 25, 33],
    b: [6, 38, 45],
  };

  const REMOTE_FONT_SOURCES = {
    "SpaceGrotesk-Regular": {
      url: "/assets/fonts/SpaceGrotesk-Regular.ttf",
      fontName: "SpaceGrotesk",
      fontStyle: "normal",
    },
    "FredokaOne-Regular": {
      url: "/assets/fonts/FredokaOne-Regular.ttf",
      fontName: "FredokaOne",
      fontStyle: "normal",
    },
  };

  const EMBEDDED_FONT_DATA =
    (typeof window !== "undefined" && window.FONT_DATA) ||
    (typeof FONT_DATA !== "undefined" && FONT_DATA) ||
    {};

  const REMOTE_FONT_VARIANTS = Object.entries(REMOTE_FONT_SOURCES).map(
    ([key, font]) => ({
      key,
      family: font.fontName,
      style: font.fontStyle || "normal",
      url: font.url,
      fileName:
        font.fileName ||
        `${font.fontName}-${font.fontStyle || "normal"}.${
          (font.url && font.url.split(".").pop()) || "ttf"
        }`,
    }),
  );

  const PRIMARY_REMOTE_FAMILY = REMOTE_FONT_VARIANTS[0]?.family || DEFAULT_FONT_FAMILY;

  const remoteFontCache = new Map();

  let libsPromise = null;

  function ensureDocFontCache(doc) {
    if (!doc) return null;
    if (!doc.__compatPdfFontCache) {
      Object.defineProperty(doc, "__compatPdfFontCache", {
        value: new Set(),
        enumerable: false,
        configurable: false,
        writable: false,
      });
    }
    return doc.__compatPdfFontCache;
  }

  function arrayBufferToBase64(buffer) {
    if (typeof Buffer === "function") {
      return Buffer.from(buffer).toString("base64");
    }
    const bytes = new Uint8Array(buffer);
    const chunk = 0x8000;
    let binary = "";
    for (let i = 0; i < bytes.length; i += chunk) {
      const slice = bytes.subarray(i, i + chunk);
      binary += String.fromCharCode.apply(null, slice);
    }
    if (typeof btoa === "function") {
      return btoa(binary);
    }
    throw new Error("No base64 encoder available");
  }

  async function fetchFontBase64(font) {
    if (!font || !font.url) return null;
    if (remoteFontCache.has(font.fileName)) {
      return remoteFontCache.get(font.fileName);
    }
    if (typeof fetch !== "function") {
      return null;
    }
    const loader = (async () => {
      const res = await fetch(font.url);
      if (!res.ok) {
        throw new Error(`Failed to fetch font ${font.url} (${res.status})`);
      }
      const buf = await res.arrayBuffer();
      return arrayBufferToBase64(buf);
    })()
      .catch((err) => {
        console.warn("[compat-pdf] Unable to download font", font.fileName, err);
        remoteFontCache.delete(font.fileName);
        return null;
      });

    remoteFontCache.set(font.fileName, loader);
    return loader;
  }

  async function registerRemoteFont(doc, font) {
    if (!doc || typeof doc.addFileToVFS !== "function" || typeof doc.addFont !== "function") {
      return false;
    }
    const cache = ensureDocFontCache(doc);
    const style = font.style || "normal";
    const key = `${font.family}|${style}`;
    if (cache && cache.has(key)) {
      return true;
    }
    const embeddedBase64 = EMBEDDED_FONT_DATA[font.key];
    const base64 = embeddedBase64 || (await fetchFontBase64(font));
    if (!base64) {
      return false;
    }
    try {
      doc.addFileToVFS(font.fileName, base64);
      doc.addFont(font.fileName, font.family, style);
      if (cache) {
        cache.add(key);
      }
      return true;
    } catch (err) {
      console.warn("[compat-pdf] Failed to register font", font.fileName, err);
      return false;
    }
  }

  async function ensurePreferredFonts(doc) {
    const states = await Promise.all(
      REMOTE_FONT_VARIANTS.map(async (font) => ({
        family: font.family,
        style: font.style || "normal",
        ok: await registerRemoteFont(doc, font),
      })),
    );

    const orderedFamilies = REMOTE_FONT_VARIANTS.map((f) => f.family);
    const familyState = (family) => {
      const entries = states.filter((s) => s.family === family && s.ok);
      if (!entries.length) return null;
      return {
        family,
        hasNormal: entries.some((s) => s.style === "normal"),
        hasBold: entries.some((s) => s.style === "bold"),
        ready: true,
      };
    };

    const preferredState =
      orderedFamilies.map((family) => familyState(family)).find(Boolean) ||
      states
        .filter((s) => s.ok)
        .map((s) => familyState(s.family))
        .find(Boolean);

    if (preferredState) {
      return preferredState;
    }

    return {
      family: PRIMARY_REMOTE_FAMILY,
      hasNormal: false,
      hasBold: false,
      ready: false,
    };
  }

  function createFontController(doc, state) {
    let fallbackFamily = DEFAULT_FONT_FAMILY;
    if (doc && typeof doc.setFont === "function") {
      try {
        doc.setFont(DEFAULT_FONT_FAMILY, "normal");
        if (typeof doc.setFontSize === "function") {
          doc.setFontSize(11);
        }
        if (typeof doc.setTextColor === "function") {
          doc.setTextColor(TEXT_MAIN[0], TEXT_MAIN[1], TEXT_MAIN[2]);
        }
      } catch (err) {
        console.warn("[compat-pdf] Unable to set default font", err);
        fallbackFamily = FALLBACK_FONT_FAMILY || "helvetica";
        try {
          doc.setFont(fallbackFamily);
        } catch (_) {
          try {
            doc.setFont("helvetica");
            fallbackFamily = "helvetica";
          } catch (__) {
            /* no-op */
          }
        }
      }
    }

    const family = state?.ready ? state.family : fallbackFamily;
    const supportsBold = state?.ready ? !!state.hasBold : true;
    return {
      family,
      use(style = "normal") {
        const desiredStyle = style === "bold" && !supportsBold ? "normal" : style;
        try {
          doc.setFont(family, desiredStyle);
        } catch (_) {
          try {
            doc.setFont(fallbackFamily, style);
          } catch (err) {
            console.warn("[compat-pdf] Failed to set font", err);
          }
        }
      },
    };
  }

  function ensureFontFamily(doc, preferredFamily, style = "normal", fallbackFamily = DEFAULT_FONT_FAMILY) {
    const fallback = fallbackFamily || DEFAULT_FONT_FAMILY;
    const desired = preferredFamily || fallback;
    try {
      doc.setFont(desired, style);
      return desired;
    } catch (err) {
      try {
        doc.setFont(fallback, style);
      } catch (_) {
        console.warn("[compat-pdf] Unable to set font", desired, err);
      }
      return fallback;
    }
  }

  async function prepareFontState(doc) {
    try {
      const state = await ensurePreferredFonts(doc);
      if (state?.ready) {
        return state;
      }
    } catch (err) {
      console.warn("[compat-pdf] Font preload failed", err);
    }
    return {
      family: DEFAULT_FONT_FAMILY,
      hasNormal: true,
      hasBold: true,
      ready: false,
    };
  }

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

      let matchText = r.matchPercentStr || safeString(r.matchText);
      let matchIcon = "";

      if (r.matchPercent != null) {
        matchText = `${r.matchPercent}%`;
        matchIcon = getMatchEmoji(r.matchPercent);
      }

      rows.push({
        item: r.item,
        a: r.aText,
        match: matchText,
        b: r.bText,
        _isGroupHeader: false,
        _source: r,
        _matchIcon: matchIcon,
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
    const centerX = pageWidth / 2;

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

  function drawHeader(doc, mainTitle, sectionTitle, options, fontCtrl) {
    const opts = options || {};
    const stampText = typeof opts.timestamp === "string" && opts.timestamp
      ? opts.timestamp
      : `Generated: ${new Date().toLocaleString()}`;
    const fillBackground = opts.fillBackground !== false;
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const centerX = Number.isFinite(opts.centerX) ? opts.centerX : pageW / 2;
    const headingFamily = ensureFontFamily(doc, opts.headingFont, "bold", fontCtrl?.family);
    const bodyFamily = ensureFontFamily(doc, opts.bodyFont, "normal", fontCtrl?.family);
    const titleFamily = ensureFontFamily(doc, "FredokaOne", "normal", headingFamily);

    if (fillBackground) {
      doc.setFillColor(BG[0], BG[1], BG[2]);
      doc.rect(0, 0, pageW, pageH, "F");
    }

    const titleY = 70;
    const subtitleY = titleY + 24;
    const ruleY = subtitleY + 16;
    const pillHeight = 44;
    const pillWidth = Math.min(440, pageW * 0.6);
    const pillX = centerX - pillWidth / 2;
    const pillY = ruleY + 18;
    const sectionY = pillY + pillHeight / 2 + 2;
    const tableStartY = pillY + pillHeight + 32;

    ensureFontFamily(doc, titleFamily || headingFamily, "normal", fontCtrl?.family);
    doc.setFont(titleFamily || headingFamily, "normal");
    doc.setTextColor(ACCENT[0], ACCENT[1], ACCENT[2]);
    doc.setFontSize(40);
    doc.text(mainTitle || "TalkKink Compatibility", centerX, titleY, { align: "center" });

    doc.setFontSize(14);
    doc.setTextColor(HEADER_TEXT[0], HEADER_TEXT[1], HEADER_TEXT[2]);
    ensureFontFamily(doc, bodyFamily, "normal", headingFamily);
    doc.text(stampText, centerX, subtitleY, { align: "center" });

    doc.setDrawColor(ACCENT[0], ACCENT[1], ACCENT[2]);
    doc.setLineWidth(2.4);
    const pad = 80;
    doc.line(pad, ruleY, pageW - pad, ruleY);

    ensureFontFamily(doc, headingFamily, "bold", fontCtrl?.family);
    if (typeof doc.roundedRect === "function") {
      doc.setFillColor(SECTION_PANEL[0], SECTION_PANEL[1], SECTION_PANEL[2]);
      doc.setDrawColor(12, 69, 80);
      doc.setLineWidth(1);
      doc.roundedRect(pillX, pillY, pillWidth, pillHeight, 12, 12, "FD");
    }

    doc.setFontSize(32);
    doc.setTextColor(ACCENT[0], ACCENT[1], ACCENT[2]);
    doc.text(sectionTitle, centerX, sectionY, { align: "center", baseline: "middle" });

    return tableStartY;
  }

  function drawSummaryFooter(doc, stats, startY, fontCtrl) {
    const pageW = doc.internal.pageSize.getWidth();
    let y = startY + 18;

    if (fontCtrl) {
      fontCtrl.use("normal");
    } else {
      doc.setFont(DEFAULT_FONT_FAMILY, "normal");
    }
    doc.setFontSize(11);
    doc.setTextColor(TEXT_MAIN[0], TEXT_MAIN[1], TEXT_MAIN[2]);

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

  function renderDarkPdf(doc, rawRows, fontState) {
    const fontCtrl = createFontController(doc, fontState);
    const normRows = rawRows
      .map(normalizeCompatRow)
      .filter((r) => r && (r.item || r.aText || r.bText));

    if (!normRows.length) {
      throw new Error("No compatibility rows available");
    }

    const sectionTitle = deriveSectionTitle(rawRows);
    const mainTitle = "TalkKink Compatibility Report";
    doc.setFont(DEFAULT_FONT_FAMILY, "bold");
    const headingFont = ensureFontFamily(doc, DEFAULT_FONT_FAMILY, "bold", fontCtrl.family);
    doc.setFont(DEFAULT_FONT_FAMILY, "normal");
    const bodyFont = ensureFontFamily(doc, DEFAULT_FONT_FAMILY, "normal", fontCtrl.family);

    const layout = computeTableLayout(doc);
    const headerStamp = `Generated: ${new Date().toLocaleString()}`;
    const headerY = drawHeader(doc, mainTitle, sectionTitle, {
      timestamp: headerStamp,
      centerX: layout.centerX,
      headingFont,
      bodyFont,
    }, fontCtrl);
    const bodyRows = buildBodyRows(normRows);
    const stats = computeSummaryStats(normRows);

    const columns = [
      { header: "Kinks", dataKey: "item" },
      { header: "Partner A", dataKey: "a" },
      { header: "Match %", dataKey: "match" },
      { header: "Partner B", dataKey: "b" },
    ];

    const tableFont = ensureFontFamily(doc, bodyFont, "normal", fontCtrl.family || DEFAULT_FONT_FAMILY);

    doc.setFont(tableFont, "normal");

    doc.autoTable({
      columns,
      body: bodyRows,
      startY: headerY,
      margin: { left: layout.margin, right: layout.margin },
      theme: "grid",
      styles: {
        font: tableFont,
        fontSize: 11,
        halign: "center",
        valign: "middle",
        cellPadding: { top: 9, bottom: 9, left: 10, right: 10 },
        textColor: TEXT_MAIN,
        fillColor: TABLE_BG,
        lineColor: GRID,
        lineWidth: 1.05,
        overflow: "linebreak", // inside styles, not root (no deprecation warning)
      },
      headStyles: {
        font: headingFont,
        fontStyle: "normal",
        fontSize: 13,
        textColor: ACCENT,
        fillColor: HEADER_PANEL,
        lineColor: GRID,
        lineWidth: 1.05,
        halign: "center",
      },
      alternateRowStyles: {
        fillColor: ALT_ROW_BG,
      },
      columnStyles: {
        0: { cellWidth: layout.widths.item, halign: "left" },
        1: { cellWidth: layout.widths.a, halign: "center" },
        2: {
          cellWidth: layout.widths.match,
          halign: "center",
          cellPadding: { top: 9, bottom: 9, left: 10, right: 12 },
        },
        3: { cellWidth: layout.widths.b, halign: "center" },
      },
      didParseCell: function (data) {
        if (data.section !== "body") return;
        const raw = data.row.raw || {};
        if (raw._isGroupHeader) {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fillColor = SECTION_PANEL;
          data.cell.styles.textColor = HEADER_TEXT;
          data.cell.styles.halign = "center";

          if (data.column.dataKey === "item") {
            data.cell.colSpan = columns.length;
          } else {
            data.cell.text = [];
          }

          return;
        }

        const fill = COLUMN_FILLS[data.column.dataKey];
        if (fill && data.cell?.styles) {
          const bump = data.row.index % 2 ? 4 : 0;
          data.cell.styles.fillColor = fill.map((v) => Math.min(255, v + bump));
        }
      },
      didDrawCell: function (data) {
        if (data.section !== "body") return;
        const raw = data.row.raw || {};
        if (raw._isGroupHeader) return;
        if (data.column.dataKey === "match" && raw._matchIcon) {
          drawMatchIcon(doc, data.cell, raw._matchIcon, {
            align: "right",
            padding: 4,
          });
        }
      },
      didDrawPage: function () {
        drawHeader(doc, mainTitle, sectionTitle, {
          timestamp: headerStamp,
          centerX: layout.centerX,
        }, fontCtrl);
      },
    });

    const finalY =
      (doc.lastAutoTable && doc.lastAutoTable.finalY) || headerY + 40;
    drawSummaryFooter(doc, stats, finalY, fontCtrl);
  }

  async function tkGenerateCompatPdf(rawRows) {
    const jsPDFCtor = await ensurePdfLibs();
    const doc = new jsPDFCtor({
      orientation: "landscape",
      unit: "pt",
      format: "letter",
    });

    const fontState = await prepareFontState(doc);
    renderDarkPdf(doc, rawRows, fontState);
    doc.save("compatibility-pretty-dark.pdf");
  }

  /* -------------------------- Rows + Storage ----------------------------- */

  function getRowsFromDom() {
    if (typeof document === "undefined") return [];
    const body = document.querySelector("#compatBody");
    if (!body) return [];

    const rows = [];
    body.querySelectorAll("tr").forEach((tr) => {
      const cells = Array.from(tr.children || [])
        .slice(0, 4)
        .map((td) => safeString(td?.textContent).trim());
      if (cells.length >= 4 && cells.some((c) => c)) {
        rows.push(cells);
      }
    });
    return rows;
  }

  function getRowsFromWindow() {
    if (Array.isArray(window.talkkinkCompatRows)) {
      return window.talkkinkCompatRows.slice();
    }
    const domRows = getRowsFromDom();
    if (domRows.length) return domRows;
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
    if (!rows.length) rows = getRowsFromDom();
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
