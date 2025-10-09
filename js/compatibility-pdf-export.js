/* ==========================================================================
   Talk Kink – Compatibility PDF Export (full-bleed, dark, with labels)
   - Replaces cb_* codes with human-readable names in the PDF
   - Draws a black page background (no white margins)
   - Uses jsPDF (+ AutoTable if available) or falls back to raw table draw
   - Tries multiple label sources and merges overrides

   Assumptions:
   • The main comparison table is the first <table> inside the content wrapper,
     with columns: Category | Partner A | Match % | Partner B
   • Labels sources (any that exist will be merged):
       /data/labels-overrides.json
       /data/labels.json
       /data/kinks.json  (as a last resort for {id,name}/ {key,label} shapes)
   ========================================================================== */

(() => {
  "use strict";

  // ---------- helpers ----------
  const $ = (sel, root = document) => root.querySelector(sel);

  // Best guess for the comparison table:
  function findComparisonTable() {
    // 1) Prefer an explicitly marked table
    let t = $('table[data-compat], table#compatTable, .wrap table, main table, table');
    if (!t) throw new Error("No comparison table found.");
    return t;
  }

  // Load JSON with cache-busting and soft failure
  async function fetchJson(url) {
    const sep = url.includes("?") ? "&" : "?";
    const bust = `${sep}v=${Date.now()}`;
    try {
      const res = await fetch(url + bust, { credentials: "omit", cache: "no-store" });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      return await res.json();
    } catch (e) {
      return null;
    }
  }

  // Merge label sources into id→label
  async function buildLabelMap() {
    const map = new Map();

    // Helper to add a single entry
    const put = (id, label) => {
      if (!id) return;
      const name = (label ?? "").toString().trim();
      if (!name) return;
      map.set(id, name);
    };

    // Accept many shapes
    function absorb(payload) {
      if (!payload) return;
      // Case A: {labels:{id:label,...}}
      if (payload.labels && typeof payload.labels === "object") {
        for (const [id, label] of Object.entries(payload.labels)) put(id, label);
      }
      // Case B: Array of entries with various keys
      const arr = Array.isArray(payload.kinks) ? payload.kinks
                : Array.isArray(payload.items) ? payload.items
                : Array.isArray(payload) ? payload
                : null;
      if (arr) {
        for (const it of arr) {
          if (!it) continue;
          const id = it.id ?? it.key ?? it.code ?? it.name; // many shapes
          const label = it.name ?? it.label ?? it.title ?? null;
          if (id && label) put(id, label);
        }
      }
    }

    // Try in “override → base → kinks” order
    absorb(await fetchJson("/data/labels-overrides.json"));
    absorb(await fetchJson("/data/labels.json"));
    absorb(await fetchJson("/data/kinks.json"));

    return map;
  }

  // Extract table data → {head:[], body:[[]]}
  function tableToData(table, labelMap) {
    const head = [];
    const body = [];
    const headerRow = table.tHead?.rows?.[0] ?? table.querySelector("thead tr");
    const rows = headerRow ? Array.from(headerRow.cells) : Array.from(table.rows[0]?.cells ?? []);

    for (const th of rows) head.push(th.textContent.trim());

    const dataRows = Array.from(table.tBodies?.[0]?.rows ?? table.querySelectorAll("tbody tr"));
    const startIdx = headerRow ? 0 : 1; // skip first row if it was header in <table> without <thead>

    for (let r = startIdx; r < table.rows.length; r++) {
      const tr = table.rows[r];
      if (!tr || tr.closest("thead")) continue;
      const cells = Array.from(tr.cells).map((td, idx) => {
        let text = td.textContent.trim();

        // First column = category → replace cb_ code with friendly label
        if (idx === 0 && /^cb_[a-z0-9]+$/i.test(text)) {
          const friendly = labelMap.get(text);
          if (friendly) text = friendly;
        }
        return text || "—";
      });
      // Skip completely empty lines
      if (cells.length && cells.some(x => x !== "—" && x !== "")) body.push(cells);
    }

    return { head, body };
  }

  // Draw dark background on every page
  function fillBlackBackground(doc) {
    const w = doc.internal.pageSize.getWidth();
    const h = doc.internal.pageSize.getHeight();
    doc.setFillColor(0, 0, 0);
    doc.rect(0, 0, w, h, "F");
  }

  // Main export
  async function makeFullBleedPDF() {
    const table = findComparisonTable();
    const labelMap = await buildLabelMap();
    const { jsPDF } = window.jspdf || {};
    if (!jsPDF) {
      alert("jsPDF not found.");
      return;
    }

    const hasAutoTable =
      typeof window.jspdf?.jsPDF?.API?.autoTable === "function" ||
      typeof window.jsPDF?.API?.autoTable === "function";

    const doc = new jsPDF({
      orientation: "landscape",
      unit: "pt",
      format: "letter" // change to "a4" if desired
    });

    fillBlackBackground(doc);

    // Title + timestamp (in white)
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text("Talk Kink — Compatibility", 24, 36);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const ts = new Date().toLocaleString();
    const w = doc.internal.pageSize.getWidth();
    doc.text(ts, w - 24, 24, { align: "right" });

    const data = tableToData(table, labelMap);

    if (hasAutoTable) {
      // Full-bleed table
      doc.autoTable({
        head: [data.head],
        body: data.body,
        theme: "plain",
        margin: 0,           // NO margins
        startY: 52,          // leave a small space for the title line
        styles: {
          fillColor: [0, 0, 0],
          textColor: [255, 255, 255],
          lineColor: [128, 128, 128],
          lineWidth: 0.4,
          cellPadding: 4,
          font: "helvetica",
          fontSize: 10,
          valign: "middle"
        },
        headStyles: {
          fillColor: [0, 0, 0],
          textColor: [255, 255, 255],
          fontStyle: "bold",
          lineColor: [160, 160, 160],
          lineWidth: 0.6
        },
        alternateRowStyles: { fillColor: [18, 18, 18] },
        columnStyles: {
          0: { cellWidth: "auto" },        // Category
          1: { halign: "center", cellWidth: 70 },
          2: { halign: "center", cellWidth: 90 },
          3: { halign: "center", cellWidth: 70 }
        },
        didDrawPage: () => {
          fillBlackBackground(doc); // ensure black on every page
          // redraw the title (AutoTable clears the page background)
          doc.setTextColor(255, 255, 255);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(22);
          doc.text("Talk Kink — Compatibility", 24, 36);
          doc.setFontSize(10);
          doc.setFont("helvetica", "normal");
          const ts2 = new Date().toLocaleString();
          const w2 = doc.internal.pageSize.getWidth();
          doc.text(ts2, w2 - 24, 24, { align: "right" });
        }
      });
    } else {
      // Minimal fallback (no AutoTable): draw a simple text grid
      const left = 24, top = 56, lh = 16, colGap = 12;
      const colWidths = [w * 0.55, 80, 100, 80];

      doc.setFont("helvetica", "bold"); doc.setFontSize(11);
      doc.text(data.head[0] || "Category", left, top);
      let x = left + colWidths[0] + colGap;
      for (let i = 1; i < data.head.length; i++) {
        doc.text(String(data.head[i]), x, top);
        x += colWidths[i] + colGap;
      }

      doc.setFont("helvetica", "normal"); doc.setFontSize(10);
      let y = top + 10;
      for (const row of data.body) {
        y += lh; x = left;
        for (let i = 0; i < row.length; i++) {
          const cell = String(row[i] ?? "—");
          doc.text(cell, x, y);
          x += colWidths[i] + colGap;
        }
        if (y > doc.internal.pageSize.getHeight() - 24) {
          doc.addPage();
          fillBlackBackground(doc);
          y = 36;
        }
      }
    }

    doc.save("compatibility.pdf");
  }

  // Optional: replace codes → labels in the on-screen table too
  async function swapCodesForLabelsOnScreen() {
    const table = findComparisonTable();
    const labelMap = await buildLabelMap();
    // For each category cell (first column)
    const rows = Array.from(table.tBodies?.[0]?.rows ?? table.querySelectorAll("tbody tr"));
    for (const tr of rows) {
      const cell = tr.cells?.[0];
      if (!cell) continue;
      const txt = cell.textContent.trim();
      if (/^cb_[a-z0-9]+$/i.test(txt)) {
        const friendly = labelMap.get(txt);
        if (friendly) cell.textContent = friendly;
      }
    }
  }

  function boot() {
    const dl = $("#dl"); // Download PDF button
    if (dl) dl.addEventListener("click", (e) => { e.preventDefault(); makeFullBleedPDF(); });

    // Optional: also reflect names on the page (uncomment to enable)
    // swapCodesForLabelsOnScreen();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
