/************************************************************
 *  COMPLETE STEPS FOR CODEX (DO NOT REMOVE)
 *
 * 1. Replace your current compatibility PDF generator with THIS file.
 * 2. Ensure jspdf and jspdf-autotable are installed.
 * 3. This generator reads normalized TalkKink compatibility JSON:
 *      surveyData = { categories: [ { label, avgMatchPercent, items[] } ] }
 * 4. Every category prints in its own glowing box.
 * 5. Each item prints:
 *        Kink | Partner A | Emoji | Partner B | % Match
 * 6. Compatibility bars draw under each category.
 * 7. Title + timestamp are perfectly centered.
 * 8. The entire page uses your dark teal glowing theme.
 *
 ************************************************************/

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// 🌑 DARK THEME + TEAL ACCENT
const THEME = {
  bg: "#0d1117",
  panel: "#111827",
  text: "#d8eefe",
  accent: "#00eaff",
  low: "#ff5f5f",
  mid: "#ffdd57",
  high: "#73ff91",
};

// ⭐🚩 MATCH EMOJIS
function matchEmoji(n) {
  if (n === "N/A") return "⬛";
  if (n >= 90) return "⭐";
  if (n <= 30) return "🚩";
  if (n >= 80) return "🟩";
  return "";
}

// 📏 COMPATIBILITY BAR
function drawBar(doc, x, y, pct, width = 90, height = 6) {
  doc.setFillColor("#000000");
  doc.rect(x, y, width, height, "F");

  let barColor = THEME.low;
  if (pct >= 90) barColor = THEME.high;
  else if (pct >= 60) barColor = THEME.mid;

  doc.setFillColor(barColor);
  doc.rect(x, y, (pct / 100) * width, height, "F");
}

// 🔠 SHORT LABEL FITTER
function shortLabel(label) {
  if (label.length <= 24) return label;
  return label.slice(0, 21) + "...";
}

// 🎯 CENTERED TITLE
function drawTitle(doc, text, y) {
  const w = doc.internal.pageSize.getWidth();
  doc.setFontSize(26);
  doc.setTextColor(THEME.accent);
  doc.text(text, w / 2, y, { align: "center" });
}

// 🕒 CENTERED TIMESTAMP
function drawTimestamp(doc, y) {
  const w = doc.internal.pageSize.getWidth();
  const stamp = "Generated: " + new Date().toLocaleString();
  doc.setFontSize(11);
  doc.setTextColor("#9bbad1");
  doc.text(stamp, w / 2, y, { align: "center" });
}

// 🖨️ MAIN PDF GENERATOR
export function generateCompatibilityPDF(
  surveyData,
  filename = "compatibility.pdf",
  hooks = {},
) {
  const createDoc = typeof hooks.createDoc === "function"
    ? hooks.createDoc
    : () => new jsPDF({ orientation: "portrait", unit: "pt", format: "A4" });
  const table = typeof hooks.autoTable === "function" ? hooks.autoTable : autoTable;

  const doc = createDoc();

  // BACKGROUND
  doc.setFillColor(THEME.bg);
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), doc.internal.pageSize.getHeight(), "F");

  let y = 60;

  // TITLE + TIMESTAMP
  drawTitle(doc, "TalkKink Compatibility Report", y);
  y += 22;
  drawTimestamp(doc, y);
  y += 30;

  // LOOP CATEGORIES
  for (const cat of surveyData.categories) {
    if (!cat.items || !cat.items.length) continue;

    // CATEGORY HEADER
    doc.setFontSize(16);
    doc.setTextColor(THEME.accent);
    doc.text(cat.label, 50, y);

    y += 10;

    // BOX START
    const boxStartY = y;
    const pageWidth = doc.internal.pageSize.getWidth();

    // BUILD TABLE ROWS
    const rows = cat.items.map((it) => {
      const A = it.partnerA ?? "—";
      const B = it.partnerB ?? "—";
      const pct = it.matchPercent ?? "N/A";
      return [
        shortLabel(it.label),
        String(A),
        matchEmoji(pct),
        String(B),
        String(pct),
      ];
    });

    // TABLE
    table(doc, {
      startY: y + 4,
      margin: { left: 50, right: 50 },
      tableWidth: "auto",
      head: [["Kink", "A", "", "B", "%"]],
      body: rows,

      theme: "grid",

      headStyles: {
        fillColor: THEME.accent,
        textColor: "#000",
        halign: "center",
        fontSize: 12,
      },

      styles: {
        textColor: THEME.text,
        fillColor: THEME.panel,
        halign: "center",
        valign: "middle",
        fontSize: 10,
        cellPadding: 5,
      },

      bodyStyles: {
        fillColor: THEME.panel,
      },

      columnStyles: {
        0: { halign: "center" },
        1: { halign: "center" },
        2: { halign: "center" },
        3: { halign: "center" },
        4: { halign: "center" },
      },

      didDrawPage: (data) => {
        y = data.cursor.y + 10;
      },
    });

    // AVERAGE MATCH BAR
    const avg = cat.avgMatchPercent ?? 0;

    doc.setFontSize(11);
    doc.setTextColor(THEME.text);
    doc.text(`Avg Match: ${avg}%`, 50, y);

    drawBar(doc, 130, y - 6, avg);

    y += 30;

    // PAGE BREAK
    if (y > 720) {
      doc.addPage();
      doc.setFillColor(THEME.bg);
      doc.rect(0, 0, doc.internal.pageSize.getWidth(), doc.internal.pageSize.getHeight(), "F");
      y = 60;
    }
  }

  // SAVE
  doc.save(filename);
}

export default generateCompatibilityPDF;

/************************************************************
 *  EXPECTED JSON STRUCTURE FOR surveyData:
 *
 *  {
 *    "categories": [
 *      {
 *        "label": "Impact Play",
 *        "avgMatchPercent": 87,
 *        "items": [
 *          {
 *            "label": "Spanking",
 *            "partnerA": 5,
 *            "partnerB": 4,
 *            "matchPercent": 90
 *          },
 *          { ... }
 *        ]
 *      },
 *      { ... }
 *    ]
 *  }
 *
 ************************************************************/
