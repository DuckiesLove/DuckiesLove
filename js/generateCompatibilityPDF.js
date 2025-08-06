export function generateCompatibilityPDF(compatibilityData) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });

  // Black background and white text
  doc.setFillColor(0, 0, 0);
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.rect(0, 0, pageWidth, pageHeight, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Kink Compatibility Report', 200, 40);

  let y = 80;
  const margin = 40;

  const drawBar = (x, y, width, percent) => {
    let color = [255, 0, 0];
    if (percent >= 90) color = [255, 215, 0]; // gold for star
    else if (percent >= 80) color = [0, 255, 0]; // green
    doc.setFillColor(...color);
    doc.rect(x, y, (width * percent) / 100, 8, 'F');
  };

  const shorten = str => (str.length > 40 ? str.slice(0, 37) + '…' : str);

  // Table headers
  doc.setFontSize(12);
  doc.setTextColor(200, 200, 255);
  doc.text('Kink', margin, y);
  doc.text('A', 320, y);
  doc.text('B', 350, y);
  doc.text('%', 380, y);
  y += 20;

  compatibilityData.categories.forEach(category => {
    doc.setTextColor(173, 216, 230);
    doc.setFont('helvetica', 'bold');
    doc.text(category.category || category.name, margin, y);
    y += 16;

    category.items.forEach((item, index) => {
      const name = shorten(item.label || item.name || `Item ${index + 1}`);
      const a = typeof item.partnerA === 'number' ? item.partnerA :
        typeof item.scoreA === 'number' ? item.scoreA : 0;
      const b = typeof item.partnerB === 'number' ? item.partnerB :
        typeof item.scoreB === 'number' ? item.scoreB : 0;
      const match = typeof item.match === 'number' ? item.match :
        Math.max(0, 100 - Math.abs(a - b) * 20);

      let flag = '';
      if (match >= 90) flag = '⭐';
      else if (match >= 80) flag = '🟩';
      else if (match <= 30) flag = '🚩';

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10);
      doc.text(name, margin, y);
      doc.text(`${a}`, 320, y);
      doc.text(`${b}`, 350, y);
      doc.text(`${match}%`, 380, y);
      doc.text(flag, 410, y);

      drawBar(440, y - 6, 100, match);

      y += 14;
      if (y > 740) {
        doc.addPage();
        doc.setFillColor(0, 0, 0);
        doc.rect(0, 0, pageWidth, pageHeight, 'F');
        doc.setTextColor(255, 255, 255);
        y = 40;
      }
    });

    y += 12;
  });

  doc.save('TalkKink-Compatibility.pdf');
  return doc;
}

export default generateCompatibilityPDF;
