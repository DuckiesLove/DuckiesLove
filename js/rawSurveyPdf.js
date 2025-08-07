// 🧾 Kink Compatibility PDF Generator
// Partner A = "Upload Your Survey"
// Partner B = "Upload Partner's Survey"
// Called when the user clicks "Download PDF" to compare both surveys
// and display scores, matches and flags for each kink category.

export function generateCompatibilityPDF(partnerAData, partnerBData, doc) {
  const categories = Object.keys(partnerAData); // Same keys assumed in partnerBData

  categories.forEach((category) => {
    const items = Object.keys(partnerAData[category]);

    // 🧠 Render category header (e.g., "Appearance Play")
    renderCategoryHeaderPDF(doc, category);

    items.forEach((item) => {
      // 1️⃣ Get scores
      const scoreA = partnerAData?.[category]?.[item];
      const scoreB = partnerBData?.[category]?.[item];

      // 2️⃣ Default fallback
      const scoreAText = scoreA !== undefined ? String(scoreA) : "N/A";
      const scoreBText = scoreB !== undefined ? String(scoreB) : "N/A";

      // 3️⃣ Match %
      let matchText = "N/A";
      let flag = "";

      if (typeof scoreA === "number" && typeof scoreB === "number") {
        const diff = Math.abs(scoreA - scoreB);
        const match = 100 - diff * 20; // 5-point scale
        matchText = `${match}%`;

        // 4️⃣ Flag logic
        if (match >= 90) flag = "⭐";
        else if (match >= 80) flag = "🟩";
        else if (match <= 40) flag = "🚩";
      }

      // 5️⃣ Render row
      renderRowPDF(doc, {
        label: item,
        scoreA: scoreAText,
        match: matchText,
        flag: flag,
        scoreB: scoreBText,
      });
    });
  });
}

// 📍 Draw category title (left-aligned)
function renderCategoryHeaderPDF(doc, title) {
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text(title, 50, doc.y);
  doc.y += 10;
}

// 🧾 Render a row: Label | A | Match | Flag | B
function renderRowPDF(doc, { label, scoreA, match, flag, scoreB }) {
  const y = doc.y;
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);

  doc.text(label, 50, y);       // Kink subcategory
  doc.text(scoreA, 250, y);     // Partner A
  doc.text(match, 300, y);      // Match %
  doc.text(flag, 350, y);       // Flag
  doc.text(scoreB, 400, y);     // Partner B

  doc.y += 8;
}

export default generateCompatibilityPDF;

