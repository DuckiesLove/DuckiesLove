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

function drawCompatibilityBar(doc, x, y, percent, width = 80, height = 6, label = "") {
  const tealColor = [34, 204, 204];
  const bgColor = [50, 50, 50];
  const textColor = [255, 255, 255];
  const labelX = x + width + 4;

  const safePercent = Number.isFinite(percent) ? Math.max(0, Math.min(100, percent)) : 0;
  const labelText = Number.isFinite(percent) ? `${Math.round(safePercent)}%` : "N/A";

  doc.setFillColor(...bgColor);
  doc.rect(x, y, width, height, "F");

  doc.setFillColor(...tealColor);
  doc.rect(x, y, (safePercent / 100) * width, height, "F");

  doc.setTextColor(...textColor);
  doc.setFontSize(8);
  doc.text(label || labelText, labelX, y + height - 1);
}

function drawCategoryBox(doc, x, y, width, height, label) {
  const borderColor = [34, 204, 204];
  const bgColor = [25, 25, 25];
  const textColor = [255, 255, 255];

  doc.setDrawColor(...borderColor);
  doc.setFillColor(...bgColor);
  doc.roundedRect(x, y, width, height, 4, 4, "FD");

  doc.setTextColor(...textColor);
  doc.setFontSize(10);
  doc.text(label, x + 4, y + 6);
}

function renderCategoryGroup(doc, startX, startY, category) {
  const padding = 6;
  const rowHeight = 10;
  const maxBarWidth = 80;
  const items = category.items || [];
  const groupHeight = Math.max(rowHeight * items.length + 20, 26);
  const groupWidth = 180;

  drawCategoryBox(doc, startX, startY, groupWidth, groupHeight, category.label);

  items.forEach((item, i) => {
    const labelX = startX + 6;
    const labelY = startY + 16 + i * rowHeight;

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.text(item.label, labelX, labelY);

    const barX = startX + groupWidth - maxBarWidth - 10;
    drawCompatibilityBar(doc, barX, labelY - 5, item.match);
  });

  return startY + groupHeight + padding;
}

function renderAllCategories(doc, data, startX, startY) {
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = startY;
  const x = startX;

  data.forEach((category) => {
    const estimatedHeight = Math.max(category.items.length * 10 + 26, 32);
    if (y + estimatedHeight > pageHeight - 20) {
      doc.addPage();
      y = 20;
    }
    y = renderCategoryGroup(doc, x, y, category);
  });
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

    const items = getAllRows();
    if (!items.length) {
      alert("Upload both partner surveys first, then try again.");
      return;
    }

    const summary = getSummaryStats();
    const pageWidth = pdf.internal.pageSize.getWidth();
    const teal = [34, 204, 204];
    const cardBg = [30, 30, 30];

    // Title
    pdf.setFontSize(24);
    pdf.setTextColor(...teal);
    pdf.text("TalkKink Compatibility", pageWidth / 2, 20, { align: "center" });

    // Timestamp
    pdf.setFontSize(10);
    pdf.setTextColor(255);
    pdf.text(`Generated ${formatDate(new Date())}`, pageWidth / 2, 27, {
      align: "center",
    });

    pdf.setDrawColor(...teal);
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
      pdf.setFillColor(...cardBg);
      pdf.rect(boxX, boxY, boxW, boxH, "F");
      pdf.setTextColor(...teal);
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

    const categories = groupRowsByCategory(items);
    renderAllCategories(pdf, categories, 15, boxY + boxH + 25);

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
  const category = normalizeCategoryLabel(
    row.category ?? row.categoryLabel ?? row.group ?? row.section ?? row.categoryName,
  );

  return {
    label: row.label || row.item || "—",
    a,
    b,
    match,
    emoji,
    category,
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

function normalizeCategoryLabel(label) {
  if (label === null || label === undefined) return "Compatibility";
  const text = String(label).trim();
  return text || "Compatibility";
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

function groupRowsByCategory(rows) {
  const grouped = new Map();

  rows.forEach((row) => {
    const category = normalizeCategoryLabel(row.category);
    const label = normalizeLabel(row.label);
    const itemLabel = row.emoji ? `${row.emoji} ${label}`.trim() : label;
    const match = Number.isFinite(row.match) ? Math.round(row.match) : null;

    if (!grouped.has(category)) {
      grouped.set(category, []);
    }

    grouped.get(category).push({
      label: itemLabel,
      match,
    });
  });

  return Array.from(grouped.entries())
    .map(([label, items]) => ({
      label,
      items: items.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" })),
    }))
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));
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
