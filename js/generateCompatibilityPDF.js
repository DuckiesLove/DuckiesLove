// 📄 generateCompatibilityPDF.js
// This code modifies the existing generateCompatibilityPDF function to:
/// - Use a black background
/// - Shorten kink labels
/// - Show individual partner scores (1–5 scale) in boxes
/// - Show compatibility percentage as a single center-aligned progress bar with color rules
/// - Include flags: ⭐ for 100%, 🟩 for 80–99%, 🚩 for ≤50%
/// - Align category headers with left edge (not inside a box)

document.getElementById("downloadPDF").addEventListener("click", generateCompatibilityPDF);

function generateCompatibilityPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF("p", "pt", "a4");
  const margin = 40;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const maxY = pageHeight - margin;
  let y = 60;

  // Column positions
  const colA = margin + 150;
  const colB = pageWidth - margin - 60;
  const centerBarX = (colA + colB) / 2 - 60;

  // Font & styling
  doc.setFont("helvetica", "normal");
  doc.setFillColor(0, 0, 0);
  doc.rect(0, 0, pageWidth, pageHeight, "F");

  // Title
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.text("Kink Compatibility Report", pageWidth / 2, 30, { align: "center" });

  // Drawing helpers
  function drawScoreBox(x, y, score) {
    doc.setDrawColor(255);
    doc.setLineWidth(0.8);
    doc.rect(x, y - 10, 30, 16);
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text(score !== null ? String(score) : "", x + 7, y + 2);
  }

  function drawBar(x, y, percent) {
    let barColor;
    if (percent === 100) barColor = [255, 215, 0]; // gold ⭐
    else if (percent >= 80) barColor = [0, 255, 0]; // 🟩 green
    else if (percent <= 50) barColor = [255, 0, 0]; // 🚩 red
    else barColor = [200, 200, 200]; // neutral gray

    doc.setDrawColor(255);
    doc.setFillColor(...barColor);
    doc.rect(x, y - 10, 120 * (percent / 100), 16, "F");
  }

  function getFlag(percent) {
    if (percent === 100) return "⭐";
    if (percent >= 80) return "🟩";
    if (percent <= 50) return "🚩";
    return "";
  }

  function shortenLabel(label) {
    const map = {
      "Choosing my partner’s outfit for the day or a scene": "Choosing outfit",
      "Selecting their underwear, lingerie, or base layers": "Picking underwear",
      "Styling their hair (braiding, brushing, tying, etc.)": "Styling hair",
      "Picking head coverings (bonnets, veils, hoods, hats)": "Head coverings",
      "Offering makeup, polish, or accessories as part of ritual or play": "Makeup/accessories",
      "Creating themed looks (slutty, innocent, doll-like, etc.)": "Themed looks",
      "Dressing them in role-specific costumes (maid, teacher, pet, etc.)": "Roleplay outfits",
      "Curating time-period or historical outfits (e.g., Victorian, 50s)": "Historical outfits",
      "Helping them present more femme, masc, or androgynous": "Femme/masc styling",
      "Coordinating their look with mine for public or private use": "Coordinated outfits",
      "Implementing a “dress ritual” or aesthetic prep rule": "Dress ritual",
      "Enforcing a visual protocol (e.g., no bra, heels, etc.)": "Visual protocol",
      "Having my outfit selected for me by a partner": "Partner-picked outfit",
      "Wearing the underwear or lingerie they choose": "Chosen lingerie",
      "Having my hair brushed, braided, tied, or styled": "Hair styled for partner",
      "Partner-selected headwear (bonnets, veils, hoods, hats)": "Partner-selected headwear",
    };
    return map[label] || label;
  }

  const data = window.compatibilityData;
  if (!data?.categories) return;

  doc.setFontSize(14);

  data.categories.forEach((category) => {
    if (y > maxY - 100) {
      doc.addPage();
      doc.setFillColor(0, 0, 0);
      doc.rect(0, 0, pageWidth, pageHeight, "F");
      y = 60;
    }

    // Category Title
    doc.setTextColor(255, 255, 255);
    doc.setFont(undefined, "bold");
    doc.text(category.name, margin, y);
    y += 20;

    doc.setFont(undefined, "normal");

    category.items.forEach((item) => {
      if (y > maxY - 40) {
        doc.addPage();
        doc.setFillColor(0, 0, 0);
        doc.rect(0, 0, pageWidth, pageHeight, "F");
        y = 60;
      }

      const shortLabel = shortenLabel(item.name);
      const scoreA = item.partnerA ?? null;
      const scoreB = item.partnerB ?? null;
      const percent = scoreA !== null && scoreB !== null ? 100 - Math.abs(scoreA - scoreB) * 25 : null;
      const flag = percent !== null ? getFlag(percent) : "";

      // Kink label
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(11);
      doc.text(shortLabel, margin, y);

      // Partner A score box
      drawScoreBox(colA, y, scoreA);

      // Compatibility bar in center
      if (percent !== null) drawBar(centerBarX, y, percent);

      // Partner B score box
      drawScoreBox(colB, y, scoreB);

      // Flag
      if (flag) doc.text(flag, centerBarX + 130, y);

      y += 22;
    });

    y += 10;
  });

  doc.save("compatibility_report.pdf");
}
