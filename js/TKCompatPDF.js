// TKCompatPDF.js — Codex-compatible PDF generator for TalkKink

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// Config
const neonColor = "#00f7ff";
const darkBg = "#111111";
const grayText = "#cccccc";
const whiteText = "#ffffff";
const sectionTitleFont = "FredokaOne";

// Shorten long labels for cleaner PDF spacing
function shortenLabel(label) {
  return label.replace("Giving:", "")
              .replace("Receiving:", "")
              .replace("General:", "")
              .trim();
}

function formatTimestamp() {
  return new Date().toLocaleString();
}

// Main PDF generation
export const TKCompatPDF = {
  notifyRowsUpdated: (category, rows) => {
    localStorage.setItem("tk.rows." + category, JSON.stringify(rows));
  },

  download: () => {
    const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();

    // Fonts and Styling
    doc.setFont(sectionTitleFont || "helvetica", "bold");
    doc.setFontSize(28);
    doc.setTextColor(neonColor);
    doc.text("TalkKink Compatibility Survey", pageWidth / 2, 60, { align: "center" });

    // Timestamp
    doc.setFontSize(10);
    doc.setTextColor(grayText);
    doc.text(`Generated: ${formatTimestamp()}`, pageWidth / 2, 80, { align: "center" });

    // Section Header
    doc.setFontSize(20);
    doc.setTextColor(neonColor);
    doc.text("Behavioral Play", pageWidth / 2, 120, { align: "center" });

    // Load data from localStorage
    const rows = JSON.parse(localStorage.getItem("tk.rows.Behavioral Play") || "[]");

    // Format table data
    const data = rows.map(row => {
      const match = row.a === row.b ? "100%" : `${100 - Math.abs(row.a - row.b) * 20}%`;
      return [shortenLabel(row.kink), row.a, match, row.b];
    });

    // Table layout
    autoTable(doc, {
      head: [["Kinks", "Partner A", "Match", "Partner B"]],
      body: data,
      startY: 140,
      styles: {
        fontSize: 10,
        textColor: whiteText,
        fillColor: darkBg,
        halign: "left"
      },
      headStyles: {
        fillColor: "#000000",
        textColor: neonColor,
        fontStyle: "bold"
      },
      alternateRowStyles: { fillColor: "#1a1a1a" },
      margin: { left: 40, right: 40 }
    });

    doc.save("compatibility.pdf");
  }
};
