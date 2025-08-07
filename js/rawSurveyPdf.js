// 🧾 Kink Compatibility PDF Generator
// This script takes two uploaded JSON survey files—one from the user (Partner A)
// and one from their partner (Partner B)—and renders a PDF with matched scores,
// percentages, and compatibility flags across each kink category.

export function generateCompatibilityPDF(partnerAData, partnerBData, doc) {
  const categories = Object.keys(partnerAData); // Same keys should exist in partnerBData

  categories.forEach((category) => {
    const items = Object.keys(partnerAData[category]);

    // Draw category header (e.g., "Appearance Play")
    renderCategoryHeaderPDF(doc, category);

    items.forEach((item) => {
      // 1️⃣ Retrieve Scores
      const scoreA = partnerAData?.[category]?.[item];
      const scoreB = partnerBData?.[category]?.[item];

      // 2️⃣ Handle missing data
      const displayA = scoreA !== undefined ? scoreA : "N/A";
      const displayB = scoreB !== undefined ? scoreB : "N/A";

      // 3️⃣ Match Calculation
      let match = "N/A";
      if (scoreA !== undefined && scoreB !== undefined) {
        const diff = Math.abs(scoreA - scoreB);
        match = 100 - diff * 20; // Each step difference drops 20%
      }

      // 4️⃣ Flag Assignment
      let flag = "";
      if (match !== "N/A") {
        if (match >= 90) flag = "⭐";
        else if (match >= 80) flag = "🟩";
        else if (match <= 40) flag = "🚩";
      }

      // 5️⃣ Render row in this order:
      // Label | Partner A Score | Match % | Flag | Partner B Score
      renderRowPDF(doc, {
        label: item,
        scoreA: displayA,
        scoreB: displayB,
        match: match !== "N/A" ? `${match}%` : "N/A",
        flag: flag,
      });
    });
  });
}

// ➕ Helper: Draw category title
function renderCategoryHeaderPDF(doc, category) {
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text(category, 50, doc.y);
  doc.y += 10;
}

// ➕ Helper: Draw one row in the layout
function renderRowPDF(doc, { label, scoreA, scoreB, match, flag }) {
  const y = doc.y;
  doc.setFontSize(10);
  doc.text(String(label), 50, y);
  doc.text(String(scoreA), 250, y);
  doc.text(String(match), 300, y);
  doc.text(String(flag), 350, y);
  doc.text(String(scoreB), 400, y);
  doc.y += 8;
}

export default generateCompatibilityPDF;

