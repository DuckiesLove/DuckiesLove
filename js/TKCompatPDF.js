import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const STORAGE_KEY = "TKCompat.matchTableData";

const TKCompatPDF = {
  download() {
    const doc = new jsPDF({ orientation: "landscape" });
    const title = "TalkKink Compatibility";
    const timestamp = `Generated ${new Date().toLocaleString()}`;

    // Document Header
    doc.setTextColor(0, 255, 255); // Bright cyan
    doc.setFontSize(22);
    doc.text(title, 14, 20);

    doc.setTextColor(200);
    doc.setFontSize(10);
    doc.text(timestamp, 14, 27);

    // Load data from localStorage
    const data = readRowsFromStorage();

    // Format columns
    const headers = [
      { header: "Item", dataKey: "label" },
      { header: "Partner A", dataKey: "scoreA" },
      { header: "Match", dataKey: "match" },
      { header: "Partner B", dataKey: "scoreB" }
    ];

    const rows = data.map((row) => ({
      label: row.label || "—",
      scoreA: formatScore(row.scoreA ?? row.a ?? row.aScore),
      match: formatMatch(row.match ?? row.matchPct),
      scoreB: formatScore(row.scoreB ?? row.b ?? row.bScore)
    }));

    // Create Table
    autoTable(doc, {
      startY: 35,
      head: [headers.map((h) => h.header)],
      body: rows.map((row) => [row.label, row.scoreA, row.match, row.scoreB]),
      styles: {
        fontSize: 10,
        textColor: [255, 255, 255],
        lineColor: [100, 100, 100],
        lineWidth: 0.1,
        fillColor: [30, 30, 30]
      },
      headStyles: {
        fillColor: [0, 255, 255],
        textColor: 0,
        fontStyle: "bold"
      },
      alternateRowStyles: { fillColor: [45, 45, 45] },
      theme: "striped"
    });

    // Save
    doc.save("TalkKink-Compatibility.pdf");
  },

  notifyRowsUpdated(rows) {
    writeRowsToStorage(rows);
  }
};

function formatScore(score) {
  return typeof score === "number" ? score : "—";
}

function formatMatch(match) {
  return typeof match === "number" ? `${match}%` : "—";
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
