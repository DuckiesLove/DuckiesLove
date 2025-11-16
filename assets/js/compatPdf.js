/**
 * TalkKink Compatibility PDF – FINAL SINGLE FILE (CDN-ONLY)
 * ---------------------------------------------------------
 * ✔ NO vendor/ folder calls
 * ✔ Uses jsPDF + autoTable **ONLY from CDN**
 * ✔ NO flag column at all
 * ✔ Columns = Item | Partner A | Match | Partner B
 * ✔ Reads comparison rows from window.talkkinkCompatRows or localStorage
 * ✔ Buttons only enable when both surveys are loaded
 * ✔ Fully compatible with compatibility.html
 */

(() => {
  const CFG = {
    pdfKillSwitch: false,
    selectors: { downloadBtn: '#downloadPdfBtn, #downloadBtn, [data-download-pdf]' },

    columns: [
      { key: 'item', header: 'Item', w: 320 },
      { key: 'a', header: 'Partner A', w: 80 },
      { key: 'match', header: 'Match', w: 80 },
      { key: 'b', header: 'Partner B', w: 80 },
    ],

    cdn: {
      jspdf: [
        "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
        "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js",
        "https://unpkg.com/jspdf@2.5.1/dist/jspdf.umd.min.js"
      ],
      autotable: [
        "https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.3/jspdf.plugin.autotable.min.js",
        "https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.3/dist/jspdf.plugin.autotable.min.js",
        "https://unpkg.com/jspdf-autotable@3.8.3/dist/jspdf.plugin.autotable.min.js"
      ]
    }
  };

  console.info("[compat] kill-switch " + (CFG.pdfKillSwitch ? "enabled" : "disabled"));

  let libsReady = false;
  let libsReadyPromise = null;
  let rowsReady = false;
  let cachedRows = [];
  let enablingErrored = false;

  /* ------------------ SCRIPT LOADING (CDN ONLY) ------------------ */

  function injectScriptOnce(src, idKey) {
    return new Promise((resolve, reject) => {
      if (idKey) {
        const existing = document.querySelector(`script[data-lib="${idKey}"]`);
        if (existing && existing.dataset.loaded === "1") return resolve();
      }

      const s = document.createElement("script");
      s.src = src;
      s.crossOrigin = "anonymous";
      s.referrerPolicy = "no-referrer";
      if (idKey) s.dataset.lib = idKey;
      s.defer = true;

      s.onload = () => {
        if (idKey) s.dataset.loaded = "1";
        resolve();
      };
      s.onerror = () => {
        s.remove();
        reject(new Error(`Failed to load ${src}`));
      };

      document.head.appendChild(s);
    });
  }

  function jsPdfPresent() {
    return !!(window.jspdf?.jsPDF || window.jsPDF);
  }

  function autoTablePresent(jsPDF) {
    return !!(
      jsPDF?.API?.autoTable ||
      window.jsPDF?.API?.autoTable ||
      window.jspdf?.autoTable
    );
  }

  async function ensureJsPDF() {
    if (jsPdfPresent()) return window.jspdf?.jsPDF || window.jsPDF;
    for (const src of CFG.cdn.jspdf) {
      try {
        await injectScriptOnce(src, "jspdf");
        if (jsPdfPresent()) break;
      } catch (e) {}
    }
    if (!jsPdfPresent()) throw new Error("jsPDF failed to load via CDN");
    return window.jspdf?.jsPDF || window.jsPDF;
  }

  async function ensureAutoTable(jsPDF) {
    if (autoTablePresent(jsPDF)) return true;
    for (const src of CFG.cdn.autotable) {
      try {
        await injectScriptOnce(src, "jspdf-autotable");
        if (autoTablePresent(jsPDF)) return true;
      } catch (e) {}
    }
    return autoTablePresent(jsPDF);
  }

  function ensurePdfLibsReady() {
    if (!libsReadyPromise) {
      libsReadyPromise = (async () => {
        const jsPDF = await ensureJsPDF();
        await ensureAutoTable(jsPDF);
        libsReady = true;
        enablingErrored = false;
        setButtonState();
        return { jsPDF, hasAutoTable: autoTablePresent(jsPDF) };
      })().catch(err => {
        libsReady = false;
        enablingErrored = true;
        libsReadyPromise = null;
        console.error("[compat-pdf] libs failed:", err);
        setButtonState();
      });
    }
    return libsReadyPromise;
  }

  /* ------------------ VALUE NORMALIZATION ------------------ */

  const ACCENT = [0, 214, 199];

  function safeString(v) {
    if (v == null) return "";
    const s = String(v).trim();
    return s === "undefined" || s === "null" ? "" : s;
  }

  function coerceScore(v) {
    if (v == null) return null;
    const n = Number(String(v).replace(/[^\d.-]/g, ""));
    return Number.isFinite(n) ? n : null;
  }

  function computeMatch(raw, a, b) {
    const direct = coerceScore(raw);
    if (Number.isFinite(direct)) return Math.max(0, Math.min(100, direct));
    if (Number.isFinite(a) && Number.isFinite(b)) {
      const pct = 100 - (Math.abs(a - b) / 5) * 100;
      return Math.round(Math.max(0, Math.min(100, pct)));
    }
    return "";
  }

  function normalizeRow(row) {
    let item, aRaw, bRaw, mRaw;

    if (Array.isArray(row)) {
      [item, aRaw, mRaw, , bRaw] = row; // ignoring flag column index 3
    } else {
      item = row.item ?? row.label ?? "";
      aRaw = row.a ?? row.partnerA ?? "";
      bRaw = row.b ?? row.partnerB ?? "";
      mRaw = row.match ?? row.matchPct ?? row.matchPercent ?? "";
    }

    const a = coerceScore(aRaw);
    const b = coerceScore(bRaw);
    const match = computeMatch(mRaw, a, b);

    return {
      item: safeString(item),
      a: a != null ? String(a) : safeString(aRaw),
      match: match !== "" ? `${match}%` : safeString(mRaw),
      b: b != null ? String(b) : safeString(bRaw)
    };
  }

  /* ------------------ PDF RENDERING ------------------ */

  function header(doc) {
    const w = doc.internal.pageSize.getWidth();
    doc.setFillColor(18, 19, 20);
    doc.rect(0, 0, w, doc.internal.pageSize.getHeight(), "F");

    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(36);
    const t = "TalkKink Compatibility Survey";
    doc.text(t, (w - doc.getTextWidth(t)) / 2, 80);

    doc.setFontSize(12);
    const g = "Generated: " + new Date().toLocaleString();
    doc.text(g, (w - doc.getTextWidth(g)) / 2, 104);

    doc.setDrawColor(...ACCENT);
    doc.setLineWidth(2.5);
    doc.line(60, 118, w - 60, 118);

    doc.setFontSize(24);
    const st = "Behavioral Play";
    doc.text(st, (w - doc.getTextWidth(st)) / 2, 160);

    return 180;
  }

  function renderWithAutoTable(doc, rows) {
    const startY = header(doc);
    const body = rows.map(r => normalizeRow(r));

    doc.autoTable({
      startY,
      head: [["Item", "Partner A", "Match", "Partner B"]],
      body: body.map(r => [r.item, r.a, r.match, r.b]),
      margin: { left: 60, right: 60 },
      styles: {
        font: "helvetica",
        fontSize: 12,
        textColor: [230, 230, 230],
        fillColor: [25, 25, 28],
        lineColor: [40, 40, 45],
        lineWidth: 1.1,
        overflow: "linebreak"
      },
      headStyles: {
        textColor: [0, 255, 245],
        fillColor: [28, 28, 32],
        fontStyle: "bold",
        halign: "center"
      },
      columnStyles: {
        0: { cellWidth: 320, halign: "left" },
        1: { cellWidth: 80, halign: "center" },
        2: { cellWidth: 80, halign: "center" },
        3: { cellWidth: 80, halign: "center" }
      }
    });
  }

  function renderFallback(doc, rows) {
    const startY = header(doc);
    let y = startY + 20;
    doc.setFontSize(12);

    rows.forEach(r => {
      const n = normalizeRow(r);
      doc.text(`${n.item}  —  A:${n.a}  Match:${n.match}  B:${n.b}`, 60, y);
      y += 16;
    });
  }

  /* ------------------ ROW STORAGE ------------------ */

  function computeRows() {
    if (cachedRows.length) return cachedRows;
    if (Array.isArray(window.talkkinkCompatRows) && window.talkkinkCompatRows.length)
      return window.talkkinkCompatRows;

    try {
      const raw = localStorage.getItem("talkkink:compatRows");
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) return arr;
      }
    } catch (e) {}
    return [];
  }

  function setRows(arr) {
    cachedRows = Array.isArray(arr) ? arr.slice() : [];
    rowsReady = cachedRows.length > 0;
  }

  /* ------------------ BUTTON STATE ------------------ */

  function getBtn() {
    return document.querySelector(CFG.selectors.downloadBtn);
  }

  function setButtonState() {
    const btn = getBtn();
    if (!btn) return;
    const can =
      !CFG.pdfKillSwitch &&
      libsReady &&
      computeRows().length > 0 &&
      !enablingErrored;

    btn.disabled = !can;
    btn.title = can
      ? "Download PDF"
      : "Upload both surveys first and wait for green messages.";
  }

  /* ------------------ MAIN GENERATOR ------------------ */

  async function generatePDF(rows) {
    const data = rows && rows.length ? rows : computeRows();
    if (!data.length) throw new Error("No rows available");

    const { jsPDF, hasAutoTable } = await ensurePdfLibsReady();
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "letter" });

    if (hasAutoTable) renderWithAutoTable(doc, data);
    else renderFallback(doc, data);

    doc.save("talkkink-compatibility.pdf");
  }

  /* ------------------ EVENT WIRING ------------------ */

  function init() {
    const btn = getBtn();
    if (btn) btn.disabled = true;

    if (Array.isArray(window.talkkinkCompatRows))
      setRows(window.talkkinkCompatRows);

    setButtonState();
    ensurePdfLibsReady();

    if (btn) {
      btn.addEventListener("click", async () => {
        const rows = computeRows();
        if (!rows.length) {
          alert("Upload both partner surveys first, then wait for the green messages below the buttons.");
          return;
        }
        try {
          await generatePDF(rows);
        } catch (err) {
          console.error("[compat-pdf] error", err);
          alert("PDF generation failed. See console.");
        }
      });
    }
  }

  /* ------------------ PUBLIC API ------------------ */

  window.TKCompatPDF = {
    notifyRowsUpdated(rows) {
      setRows(rows);
      setButtonState();
    },
    generateFromStorage() {
      const rows = computeRows();
      if (!rows.length) {
        alert("Upload both partner surveys first.");
        return;
      }
      generatePDF(rows);
    }
  };

  document.readyState === "loading"
    ? document.addEventListener("DOMContentLoaded", init)
    : init();
})();
