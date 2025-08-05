import { calculateCompatibility } from './compatibility.js';
import { getMatchFlag } from './matchFlag.js';

function maxRating(obj) {
  if (!obj) return 0;
  const vals = [obj.giving, obj.receiving, obj.general].filter(v => typeof v === 'number');
  return vals.length ? Math.max(...vals) : 0;
}

function shortenLabel(label) {
  return label && label.length > 60 ? label.slice(0, 57) + '...' : label;
}

function drawBar(doc, x, y, width, percent) {
  const color = percent >= 90 ? [0, 255, 0] : percent <= 30 ? [255, 0, 0] : [200, 200, 200];
  doc.setFillColor(...color);
  doc.rect(x, y - 3, width * (percent / 100), 4, 'F');
}

export function generateStyledCompatibilityReport(doc, surveyA, surveyB) {
  const { kinkBreakdown } = calculateCompatibility(surveyA, surveyB);
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  let y = 40;
  doc.setFillColor(0, 0, 0);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.text('Kink Compatibility Report', pageWidth / 2, 30, { align: 'center' });
  doc.setFontSize(10);

  for (const [category, items] of Object.entries(kinkBreakdown)) {
    if (y > pageHeight - 40) {
      doc.addPage();
      doc.setFillColor(0, 0, 0);
      doc.rect(0, 0, pageWidth, pageHeight, 'F');
      doc.setTextColor(255, 255, 255);
      y = 40;
    }

    doc.setFontSize(14);
    doc.setTextColor(200, 200, 255);
    doc.text(category, 40, y);
    y += 16;
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);

    items.forEach(item => {
      const a = maxRating(item.you);
      const b = maxRating(item.partner);
      const percent = 100 - Math.abs((a ?? 0) - (b ?? 0)) * 20;
      const flag = getMatchFlag(percent);

      doc.text(shortenLabel(item.name), 40, y);
      doc.text(String(a ?? '-'), pageWidth - 100, y);
      doc.text(String(b ?? '-'), pageWidth - 70, y);
      doc.text(`${percent}% ${flag}`, pageWidth - 20, y, { align: 'right' });
      drawBar(doc, pageWidth - 160, y + 1, 40, percent);
      y += 12;

      if (y > pageHeight - 20) {
        doc.addPage();
        doc.setFillColor(0, 0, 0);
        doc.rect(0, 0, pageWidth, pageHeight, 'F');
        doc.setTextColor(255, 255, 255);
        y = 40;
      }
    });

    y += 10;
  }
}

// expose globally
if (typeof window !== 'undefined') {
  window.generateStyledCompatibilityReport = generateStyledCompatibilityReport;
}

// Add this script to ensure the "Download PDF" button works
// Assumes jsPDF is loaded via CDN before this script runs
// Uses earlier approved dark-styled PDF layout with flags and score bars

window.addEventListener("DOMContentLoaded", () => {
  const downloadBtn = document.getElementById("downloadPdfBtn");
  if (!downloadBtn) return;

  downloadBtn.addEventListener("click", async () => {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      alert("PDF library failed to load. Printing the page instead—choose 'Save as PDF' in your browser.");
      window.print();
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "pt",
      format: "letter",
    });

    try {
      const surveyDataA = window.partnerASurvey;
      const surveyDataB = window.partnerBSurvey;
      if (
        Object.keys(surveyDataA || {}).length === 0 ||
        Object.keys(surveyDataB || {}).length === 0
      ) {
        alert("Both surveys must be uploaded before generating PDF.");
        return;
      }

      generateStyledCompatibilityReport(doc, surveyDataA, surveyDataB);
      doc.save("TalkKink-Compatibility.pdf");
    } catch (err) {
      console.error("PDF generation error:", err);
      alert("Something went wrong generating the PDF.");
    }
  });
});

