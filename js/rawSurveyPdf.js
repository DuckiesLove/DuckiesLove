export function generateCompatibilityPDF(partnerAData, partnerBData, doc) {
  const categories = Object.keys(partnerAData);

  categories.forEach(category => {
    const items = Object.keys(partnerAData[category]);

    renderCategoryHeaderPDF(doc, category);

    items.forEach(label => {
      const scoreA = partnerAData?.[category]?.[label];
      const scoreB = partnerBData?.[category]?.[label];

      const hasA = typeof scoreA === 'number';
      const hasB = typeof scoreB === 'number';

      let matchText = 'N/A';
      let matchVal = null;
      let flag = '';

      if (hasA && hasB) {
        const diff = Math.abs(scoreA - scoreB);
        const match = 100 - diff * 20;
        matchText = `${match}%`;
        matchVal = match;

        if (match >= 90) flag = '⭐';
        else if (match >= 80) flag = '🟩';
        else if (match <= 30) flag = '🚩';
      }

      const renderScore = score => (typeof score === 'number' ? score : 'N/A');

      renderSubcategoryRowPDF(doc, {
        label,
        scoreA: renderScore(scoreA),
        matchText,
        matchVal,
        flag,
        scoreB: renderScore(scoreB)
      });
    });
  });
}

function renderCategoryHeaderPDF(doc, category) {
  doc.setFontSize?.(14);
  doc.setTextColor?.(255, 255, 255);
  doc.text(category, 50, doc.y);
  doc.y += 10;
}

function renderSubcategoryRowPDF(doc, { label, scoreA, matchText, matchVal, flag, scoreB }) {
  const y = doc.y;
  doc.setFontSize?.(10);
  doc.text(label, 50, y);
  doc.text(String(scoreA), 250, y);

  if (typeof doc.rect === 'function') {
    doc.setDrawColor?.(255, 255, 255);
    doc.setFillColor?.(0, 0, 0);
    doc.rect(300, y - 6, 40, 8);
    if (typeof matchVal === 'number') {
      doc.setFillColor?.(255, 255, 255);
      doc.rect(300, y - 6, (40 * matchVal) / 100, 8, 'F');
    }
    doc.text(matchText, 320, y);
  } else {
    doc.text(matchText, 300, y);
  }

  doc.text(String(flag), 350, y);
  doc.text(String(scoreB), 400, y);
  doc.y += 8;
}

export default generateCompatibilityPDF;
