export function generateCompatibilityPDF(partnerAData, partnerBData, doc) {
  const categories = Object.keys(partnerAData);
  categories.forEach(category => {
    const items = Object.keys(partnerAData[category]);
    renderCategoryHeaderPDF(doc, category);
    items.forEach(item => {
      const scoreA = partnerAData?.[category]?.[item];
      const scoreB = partnerBData?.[category]?.[item];
      const displayA = scoreA !== undefined ? scoreA : 'N/A';
      const displayB = scoreB !== undefined ? scoreB : 'N/A';
      let match = 'N/A';
      if (scoreA !== undefined && scoreB !== undefined) {
        const diff = Math.abs(scoreA - scoreB);
        match = 100 - diff * 20;
      }
      let flag = '';
      if (match !== 'N/A') {
        if (match >= 90) flag = '⭐';
        else if (match >= 80) flag = '🟩';
        else if (match <= 40) flag = '🚩';
      }
      renderRowPDF(doc, {
        label: item,
        scoreA: displayA,
        scoreB: displayB,
        match: match !== 'N/A' ? `${match}%` : 'N/A',
        flag
      });
    });
  });
}

function renderCategoryHeaderPDF(doc, category) {
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text(category, 50, doc.y);
  doc.y += 10;
}

function renderRowPDF(doc, { label, scoreA, scoreB, match, flag }) {
  const y = doc.y;
  doc.setFontSize(10);
  doc.text(label, 50, y);
  doc.text(String(scoreA), 250, y);
  doc.text(String(match), 300, y);
  doc.text(String(flag), 350, y);
  doc.text(String(scoreB), 400, y);
  doc.y += 8;
}

export default generateCompatibilityPDF;
