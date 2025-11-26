import jsPDF from "jspdf";

const STORAGE_KEY = "TKCompat.matchTableData";

function isMissingNumeric(value) {
  return value === undefined || value === null || value === "" || Number.isNaN(Number(value));
}

function formatScore(value) {
  return isMissingNumeric(value) ? "N/A" : Number(value);
}

function formatMatch(match) {
  return isMissingNumeric(match) ? "N/A" : `${Math.round(Number(match))}%`;
}

function formatDate(date) {
  return date.toLocaleString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function sanitizeValue(value) {
  if (
    value === undefined ||
    value === null ||
    value === "" ||
    (typeof value === "string" && value.trim() === "")
  ) {
    return "N/A";
  }
  return value;
}

function ensureAutoTable(doc) {
  if (doc && typeof doc.autoTable === "function") return;

  const api =
    doc?.constructor?.API ||
    jsPDF?.API ||
    globalThis?.jspdf?.jsPDF?.API ||
    globalThis?.jsPDF?.API;

  if (api && typeof api.autoTable === "function") {
    doc.autoTable = function autoTableProxy() {
      return api.autoTable.apply(this, arguments);
    };
    return;
  }

  if (typeof globalThis.__tkAutoTableFallback === "function") {
    doc.autoTable = function autoTableFallbackProxy() {
      return globalThis.__tkAutoTableFallback.apply(this, arguments);
    };
    doc.constructor.API = doc.constructor.API || {};
    doc.constructor.API.autoTable = doc.constructor.API.autoTable || globalThis.__tkAutoTableFallback;
    return;
  }

  throw new Error("jsPDF autoTable plugin not available");
}

const TKCompatPDF = {
  download() {
    const pdf = new jsPDF();
    ensureAutoTable(pdf);

    const items = getAllRows();
    if (!items.length) {
      alert("Upload both partner surveys first, then try again.");
      return;
    }

    const summary = getSummaryStats();
    const pageWidth = pdf.internal.pageSize.getWidth();

    // Title
    pdf.setFontSize(24);
    pdf.setTextColor(0, 255, 255);
    pdf.text("TalkKink Compatibility", pageWidth / 2, 20, { align: "center" });

    // Timestamp
    pdf.setFontSize(10);
    pdf.setTextColor(255);
    pdf.text(`Generated ${formatDate(new Date())}`, pageWidth / 2, 27, {
      align: "center",
    });

    pdf.setDrawColor(0, 255, 255);
    pdf.line(10, 32, pageWidth - 10, 32);

    // Summary cards
    pdf.setFontSize(12);
    pdf.setTextColor(255);
    pdf.setFont(undefined, "bold");

    const boxW = 60;
    const boxH = 30;
    const boxY = 40;
    const margin = 10;

    const summaries = [
      { label: "Items Compared", value: summary.items },
      { label: "Avg Match", value: summary.avgMatch != null ? `${summary.avgMatch}%` : "N/A" },
      { label: "80%+ Alignments", value: summary.highAlignments },
    ];

    summaries.forEach((s, i) => {
      const boxX = 10 + i * (boxW + margin);
      pdf.setFillColor(30);
      pdf.rect(boxX, boxY, boxW, boxH, "F");
      pdf.setTextColor(0, 255, 255);
      pdf.setFontSize(16);
      pdf.text(String(sanitizeValue(s.value)), boxX + boxW / 2, boxY + 15, {
        align: "center",
      });
      pdf.setTextColor(255);
      pdf.setFontSize(10);
      pdf.text(s.label, boxX + boxW / 2, boxY + 25, {
        align: "center",
      });
    });

    // Table
    const tableBody = items.map(generateRowForPDF);

    pdf.autoTable({
      head: [["Item", "Partner A", "Match", "Partner B"]],
      body: tableBody,
      styles: {
        fillColor: "#222",
        textColor: "#fff",
        halign: "left",
      },
      headStyles: {
        fillColor: "#0ff",
        textColor: "#000",
        halign: "center",
        fontStyle: "bold",
      },
      columnStyles: {
        0: { cellWidth: 100 },
        1: { cellWidth: 25, halign: "center" },
        2: { cellWidth: 25, halign: "center" },
        3: { cellWidth: 25, halign: "center" },
      },
      margin: { top: boxY + boxH + 20 },
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
  const validRows = rows.filter((row) => Number.isFinite(row.a) && Number.isFinite(row.b));
  const matchScores = validRows.map((row) => row.match).filter((m) => Number.isFinite(m));
  const avgMatch = matchScores.length
    ? Math.round(matchScores.reduce((sum, val) => sum + val, 0) / matchScores.length)
    : null;

  return {
    items: validRows.length,
    avgMatch,
    highAlignments: matchScores.filter((m) => m >= 80).length,
  };
}

function normalizeLabel(label) {
  if (label === null || label === undefined) return "Unnamed Item";
  const text = String(label).trim();
  return text || "Unnamed Item";
}

function generateRowForPDF(item) {
  const partnerA = formatScore(item?.a);
  const partnerB = formatScore(item?.b);
  const match = formatMatch(item?.match);
  const isMissing = partnerA === "N/A" || partnerB === "N/A";

  return [
    {
      content: normalizeLabel(item?.label),
      styles: {
        halign: "left",
        textColor: isMissing ? [150, 150, 150] : undefined,
      },
    },
    {
      content: partnerA,
      styles: {
        halign: "center",
        textColor: isMissing ? [150, 150, 150] : undefined,
      },
    },
    {
      content: match,
      styles: {
        halign: "center",
        textColor: isMissing ? [150, 150, 150] : undefined,
      },
    },
    {
      content: partnerB,
      styles: {
        halign: "center",
        textColor: isMissing ? [150, 150, 150] : undefined,
      },
    },
  ];
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
