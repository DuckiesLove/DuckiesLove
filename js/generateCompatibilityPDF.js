// File: js/generateCompatibilityPDF.js

function generateCompatibilityPDF(data) {
  const doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;
  const lineHeight = 7;
  const boxSize = 8;
  const colA = margin + 5;
  const colB = pageWidth - margin - 5 - boxSize;
  const centerBarX = (colA + colB) / 2;
  let y = 20;

  // Draw full black background
  doc.setFillColor(0, 0, 0);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');

  doc.setTextColor(255);
  doc.setFontSize(16);
  doc.text('Kink Compatibility Report', pageWidth / 2, 15, { align: 'center' });

  doc.setFontSize(12);

  data.categories.forEach(category => {
    const match = category.matchPercent;
    const flag = getFlag(match);
    const headerText = shortenLabel(category.name) + ' ' + flag;

    if (y > pageHeight - 40) {
      doc.addPage();
      doc.setFillColor(0, 0, 0);
      doc.rect(0, 0, pageWidth, pageHeight, 'F');
      y = 20;
    }

    doc.setTextColor(255);
    doc.setFontSize(13);
    doc.text(headerText, margin, y);
    y += 8;

    category.items.forEach(kink => {
      if (y > pageHeight - 20) {
        doc.addPage();
        doc.setFillColor(0, 0, 0);
        doc.rect(0, 0, pageWidth, pageHeight, 'F');
        y = 20;
      }

      const shortLabel = shortenLabel(kink.kink);
      const scoreA = kink.partnerA;
      const scoreB = kink.partnerB;
      const matchScore = 100 - Math.abs(scoreA - scoreB);
      const barColor = getBarColor(matchScore);
      const flagIcon = getFlag(matchScore);

      doc.setFontSize(10);
      doc.setTextColor(200);
      doc.text(shortLabel, margin, y + 6);

      drawScoreBox(doc, scoreA, colA, y, boxSize);
      drawScoreBox(doc, scoreB, colB, y, boxSize);

      drawBar(doc, matchScore, centerBarX, y, 25, 6, barColor);

      if (flagIcon) {
        doc.setFontSize(12);
        doc.text(flagIcon, centerBarX + 30, y + 6);
      }

      y += 10;
    });

    y += 5;
  });

  doc.save('compatibility_report.pdf');

  function drawScoreBox(doc, score, x, y, size) {
    doc.setDrawColor(255);
    doc.rect(x, y, size, size);
    doc.setTextColor(255);
    doc.setFontSize(10);
    doc.text(`${score}`, x + size / 2, y + size - 2, { align: 'center' });
  }

  function drawBar(doc, percent, x, y, width, height, color) {
    doc.setDrawColor(200);
    doc.setFillColor(50);
    doc.rect(x, y, width, height, 'F');

    const fillWidth = (percent / 100) * width;
    const [r, g, b] = color;
    doc.setFillColor(r, g, b);
    doc.rect(x, y, fillWidth, height, 'F');

    doc.setTextColor(255);
    doc.setFontSize(8);
    doc.text(`${percent}%`, x + width / 2, y + height - 1, { align: 'center' });
  }

  function getFlag(percent) {
    if (percent === 100) return '⭐';
    if (percent >= 80) return '🟩';
    if (percent <= 50) return '🚩';
    return '';
  }

  function getBarColor(percent) {
    if (percent >= 80) return [0, 255, 0]; // Green
    if (percent >= 60) return [255, 255, 0]; // Yellow
    return [255, 0, 0]; // Red
  }

  function shortenLabel(label) {
    const map = {
      "Face Slapping / Slap Play": "Slap Play",
      "Pet Play (General)": "Pet Play",
      "Humiliation / Degradation": "Humiliation",
      "Roleplay: Caregiver/little": "CG/little",
      "Rope Bondage": "Rope",
      "Service Submission": "Service Sub",
      "Appearance Play": "Appearance",
      "Verbal Teasing / Degradation": "Verbal Tease",
    };
    return map[label] || (label.length > 20 ? label.slice(0, 18) + '…' : label);
  }
}

// Hook up button
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('downloadPdfBtn');
  if (!btn) return;
  btn.addEventListener('click', () => {
    if (!window.compatibilityData) {
      alert('No compatibility data found.');
      return;
    }
    if (!window.jspdf?.jsPDF) {
      alert('PDF library failed to load.');
      return;
    }
    generateCompatibilityPDF(window.compatibilityData);
  });
});

