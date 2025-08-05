export function generateCompatibilityPDF(compatibilityData) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });

  const margin = 40;
  const lineHeight = 22;
  const boxSize = 22;
  let y = margin;

  const drawHeader = (text) => {
    doc.setFontSize(20);
    doc.setTextColor(0, 255, 255);
    doc.text(text, margin, y);
    y += lineHeight + 8;
  };

  const drawCategory = (category) => {
    doc.setFontSize(16);
    doc.setTextColor(255);
    doc.setFillColor(60);
    doc.rect(margin, y - 18, 515, 28, "F");
    doc.text(category.category || category.name, margin + 5, y);
    y += lineHeight;
  };

  const shortenLabel = (label) => {
    return label.length > 60 ? label.slice(0, 57) + "..." : label;
  };

  const drawScoreBox = (x, y, score) => {
    doc.setDrawColor(255);
    doc.rect(x, y, boxSize, boxSize);
    doc.setTextColor(255);
    doc.text(String(score), x + 7, y + 15);
  };

  const drawBar = (x, y, match) => {
    const width = 80;
    let color = [255, 0, 0];
    if (match >= 80) color = [0, 255, 0];
    else if (match >= 60) color = [255, 255, 0];
    doc.setFillColor(...color);
    doc.rect(x, y, width * (match / 100), 12, "F");
    doc.setTextColor(255);
    doc.text(`${match}%`, x + width / 2 - 10, y + 10);
  };

  const drawItem = (label, a, b, match) => {
    if (y > 780) {
      doc.addPage();
      y = margin;
    }
    doc.setFontSize(12);
    doc.setTextColor(255);
    doc.text(shortenLabel(label), margin, y);
    drawScoreBox(350, y - boxSize + 2, a);
    drawBar(420, y - boxSize + 5, match);
    drawScoreBox(510, y - boxSize + 2, b);
    y += lineHeight;
  };

  drawHeader("Kink Compatibility Report");

  for (const category of compatibilityData.categories) {
    drawCategory(category);
    for (const item of category.items) {
      drawItem(item.label, item.partnerA, item.partnerB, item.match);
    }
  }

  doc.save("kink-compatibility-report.pdf");
}

if (typeof document !== "undefined") {
  const attachHandler = () => {
    const downloadBtn = document.getElementById("downloadPdfBtn");
    if (!downloadBtn) {
      console.error("❌ Download button not found");
      return;
    }

    downloadBtn.addEventListener("click", async () => {
      if (!window.jspdf || !window.jspdf.jsPDF) {
        alert(
          "PDF library failed to load. Printing the page instead—choose 'Save as PDF' in your browser."
        );
        window.print();
        return;
      }

      const compatibilityData = window.compatibilityData;
      if (!compatibilityData || !compatibilityData.categories) {
        alert("Missing survey data. Please upload both surveys first.");
        return;
      }

      generateCompatibilityPDF(compatibilityData);
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", attachHandler);
  } else {
    attachHandler();
  }
}

