import jsPDF from "jspdf";

const STORAGE_KEY = "TKCompat.matchTableData";

const TKCompatPDF = {
  download() {
    const pdf = new jsPDF("p", "pt", "a4");
    const margin = 40;
    let y = margin + 20;

    const stats = getSummaryStats();
    const rows = getAllRows();

    if (!rows.length) {
      alert("Upload both partner surveys first, then try again.");
      return;
    }

    // Draw title
    pdf.setFontSize(22);
    pdf.setTextColor(0, 255, 255);
    pdf.text("TalkKink Compatibility", margin, y);
    y += 20;
    pdf.setFontSize(12);
    pdf.setTextColor(200, 200, 200);
    pdf.text(`Generated ${new Date().toLocaleString()}`, margin, y);
    y += 30;

    // Summary stats
    const statLabels = [
      [`${stats.items} Items Compared`, "Items Compared"],
      [stats.avgMatch != null ? `${stats.avgMatch}%` : "—", "Avg Match"],
      [`${stats.highAlignments}`, "80%+ Alignments"],
    ];

    const cardWidth = 160;
    statLabels.forEach(([val, label], i) => {
      const x = margin + i * (cardWidth + 20);
      pdf.setFillColor(20, 30, 40);
      pdf.rect(x, y, cardWidth, 50, "F");
      pdf.setFontSize(16);
      pdf.setTextColor(0, 255, 255);
      pdf.text(val, x + 10, y + 20);
      pdf.setFontSize(10);
      pdf.setTextColor(200, 200, 200);
      pdf.text(label, x + 10, y + 40);
    });
    y += 80;

    const renderTableHeader = () => {
      const headers = ["Item", "Partner A", "Match", "Partner B"];
      const colWidths = [240, 70, 70, 70];
      const tableStartX = margin;
      let headerX = tableStartX;
      pdf.setFontSize(12);
      pdf.setTextColor(0, 255, 255);
      headers.forEach((header, idx) => {
        pdf.text(header, headerX + 2, y);
        headerX += colWidths[idx];
      });
      y += 10;
      pdf.setDrawColor(0, 255, 255);
      pdf.line(margin, y, margin + colWidths.reduce((a, b) => a + b), y);
      y += 10;
      return { colWidths, tableStartX };
    };

    const { colWidths, tableStartX } = renderTableHeader();
    const pageHeight = pdf.internal.pageSize.getHeight();

    const renderRow = (row) => {
      const matchText = row.match != null ? `${row.match}% ${row.emoji || ""}` : "N/A";
      const rowVals = [
        row.label.length > 50 ? `${row.label.slice(0, 48)}…` : row.label,
        row.a == null ? "" : row.a.toString(),
        matchText,
        row.b == null ? "" : row.b.toString(),
      ];

      let rowX = tableStartX;
      pdf.setFontSize(10);
      pdf.setTextColor(255);
      rowVals.forEach((text, idx) => {
        pdf.text(text, rowX + 2, y);
        rowX += colWidths[idx];
      });
      y += 20;
    };

    rows.forEach((row, idx) => {
      renderRow(row);

      const needsNewPage = y > pageHeight - margin;
      const moreRows = idx < rows.length - 1;
      if (needsNewPage && moreRows) {
        pdf.addPage();
        y = margin;
        renderTableHeader();
      }
    });

    pdf.save("talkkink-compatibility.pdf");
  },

  notifyRowsUpdated(rows) {
    writeRowsToStorage(rows);
  },

  getAllRows,
  getSummaryStats,
};

function parseScore(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function parseMatch(value, a, b) {
  const num = Number(value);
  if (Number.isFinite(num)) return Math.max(0, Math.min(100, Math.round(num)));
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  const diff = Math.abs(a - b);
  return Math.max(0, Math.min(100, Math.round(100 - diff * 20)));
}

function normalizeRow(row) {
  const a = parseScore(row.scoreA ?? row.a ?? row.aScore ?? row.partnerA);
  const b = parseScore(row.scoreB ?? row.b ?? row.bScore ?? row.partnerB);
  const match = parseMatch(row.match ?? row.matchPct ?? row.matchPercent, a, b);
  const emoji = typeof row.emoji === "string" ? row.emoji : "";

  return {
    label: row.label || row.item || "—",
    a,
    b,
    match,
    emoji,
  };
}

function getAllRows() {
  const raw = readRowsFromStorage();
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeRow);
}

function getSummaryStats() {
  const rows = getAllRows();
  const matches = rows.map((row) => row.match).filter((m) => m != null);
  const avgMatch = matches.length
    ? Math.round(matches.reduce((sum, val) => sum + val, 0) / matches.length)
    : null;

  return {
    items: rows.length,
    avgMatch,
    highAlignments: matches.filter((m) => m >= 80).length,
  };
}

function readRowsFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.warn("[TKCompatPDF] Failed to read rows from storage", err);
    return [];
  }
}

function writeRowsToStorage(rows) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.isArray(rows) ? rows : []));
  } catch (err) {
    console.warn("[TKCompatPDF] Failed to persist rows", err);
  }
}

if (typeof window !== "undefined") {
  window.TKCompatPDF = TKCompatPDF;
}

export { TKCompatPDF };
export default TKCompatPDF;
