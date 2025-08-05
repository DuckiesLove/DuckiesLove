document.getElementById('downloadPdfBtn')?.addEventListener('click', () => {
  if (!window.jspdf || !window.jspdf.jsPDF) {
    alert("PDF library failed to load. Printing the page instead—choose 'Save as PDF' in your browser.");
    window.print();
    return;
  }

  generateCompatibilityPDF(window.compatibilityData);
});

function generateCompatibilityPDF(data) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;
  let y = 20;

  const colKink = margin + 2;
  const colA = 110;
  const colFlag = 135;
  const colB = 160;
  const barX = 80;
  const barWidth = 40;
  const maxY = pageHeight - 20;

  // Draw full black page background
  function drawBackground() {
    doc.setFillColor(0, 0, 0);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');
  }

  function shortenLabel(label) {
    const map = {
      "Forced Feminization / Sissification": "Feminization",
      "Objectification / Dollification": "Objectification",
      "Power Exchange / Control": "Power Play",
      "Medical / Clinical Play": "Medical Play",
      "Appearance Play": "Appearance",
      "Verbal Degradation / Name Calling": "Degradation",
      "Obedience / Discipline Training": "Discipline",
      "Reluctance / Resistance Play": "Resistance",
      "Ownership / Collaring": "Collaring",
    };
    return map[label] || label.length > 28 ? label.slice(0, 25) + "…" : label;
  }

  function getMatchFlag(percent) {
    if (percent === 100) return '⭐';
    if (percent >= 80) return '🟩';
    if (percent <= 50) return '🚩';
    return '';
  }

  function drawScoreBox(x, y, score) {
    doc.setDrawColor(255);
    doc.setFillColor(20, 20, 20);
    doc.rect(x, y - 4, 10, 6, 'FD');
    doc.setTextColor(255);
    doc.setFontSize(10);
    doc.text(String(score), x + 2.5, y);
  }

  function drawBar(x, y, percent) {
    const fillColor = percent >= 80 ? [0, 200, 0] : percent <= 50 ? [255, 0, 0] : [255, 204, 0];
    doc.setDrawColor(255);
    doc.setFillColor(40, 40, 40);
    doc.rect(x, y - 3, barWidth, 5, 'F'); // Background bar
    doc.setFillColor(...fillColor);
    doc.rect(x, y - 3, (barWidth * percent) / 100, 5, 'F'); // Fill bar
  }

  function checkSpaceAndAddPage() {
    if (y > maxY) {
      doc.addPage();
      drawBackground();
      y = 20;
    }
  }

  drawBackground();
  doc.setTextColor(255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Kink Compatibility Report', pageWidth / 2, 15, { align: 'center' });
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');

  data.categories.forEach(category => {
    checkSpaceAndAddPage();

    // Category Title
    doc.setTextColor(255);
    doc.setFontSize(12);
    doc.text(shortenLabel(category.name), colKink, y);
    y += 8;

    category.items.sort((a, b) => {
      const matchA = 100 - Math.abs(a.partnerA - a.partnerB);
      const matchB = 100 - Math.abs(b.partnerA - b.partnerB);
      return matchB - matchA;
    });

    category.items.forEach(kink => {
      checkSpaceAndAddPage();
      const match = 100 - Math.abs(kink.partnerA - kink.partnerB);
      const label = shortenLabel(kink.kink);
      const flag = getMatchFlag(match);

      doc.setTextColor(255);
      doc.setFontSize(10);
      doc.text(label, colKink, y);
      drawScoreBox(colA, y, kink.partnerA);
      doc.text(flag, colFlag + 2, y);
      drawScoreBox(colB, y, kink.partnerB);
      drawBar(barX, y + 6, match);

      y += 12;
    });

    y += 6;
  });

  doc.save('compatibility_report.pdf');
}

