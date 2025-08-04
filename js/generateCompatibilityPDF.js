// generateCompatibilityPDF.js
// Builds a styled compatibility report PDF using jspdf.

// Step 1: Define shortened labels
const shortenLabel = (label) => {
  const map = {
    "Choosing my partner's outfit for the day or a scene": "Choosing outfit",
    "Selecting their underwear, lingerie, or base layers": "Picking underwear",
    "Styling their hair (braiding, brushing, tying, etc.)": "Styling hair",
    "Picking head coverings (bonnets, veils, hoods, hats) for mood or protocol": "Head coverings",
    "Offering makeup, polish, or accessories as part of ritual or play": "Makeup / accessories",
    "Creating themed looks (slutty, innocent, doll-like, sharp, etc.)": "Themed looks",
    "Dressing them in role-specific costumes (maid, bunny, doll, etc.)": "Roleplay outfits",
    "Curating time-period or historical outfits (e.g., Victorian, 50s)": "Historical outfits",
    "Helping them present more femme, masc, or androgynous by request": "Femme/masc styling",
    "Coordinating their look with mine for public or private scenes": "Coordinated outfits",
    "Implementing a \"dress ritual\" or aesthetic preparation": "Dress ritual",
    "Enforcing a visual protocol (e.g., no bra, heels required, tied hair)": "Visual protocol",
    "Having my outfit selected for me by partner": "Partner-picked outfit",
    "Wearing the underwear or lingerie they chose": "Chosen lingerie",
    "Having my hair brushed, braided, tied, or styled for them": "Hair styled for them",
    "Putting on a head covering (e.g., bonnet, veil, hood) they chose": "Headwear by partner",
    "Following visual appearance rules as part of submission": "Visual rules",
  };
  return map[label] || label;
};

// Step 2: Get emoji flag for compatibility
const getFlag = (pct) => {
  if (pct >= 90) return "⭐";
  if (pct >= 80) return "🟩";
  if (pct <= 30) return "🚩";
  return "";
};

// Step 3: Generate the PDF
function generateCompatibilityPDF() {
  const doc = new window.jspdf.jsPDF({
    orientation: "landscape",
    unit: "pt",
    format: "letter",
  });

  const margin = 40;
  let y = 50;
  const rowSpacing = 32;
  const colA = margin + 20;
  const colAScore = colA + 220;
  const colCenter = 420;
  const colBScore = 700;
  const barWidth = 160;
  const barHeight = 14;

  // Background
  doc.setFillColor(0, 0, 0);
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), doc.internal.pageSize.getHeight(), "F");

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(255, 255, 255);
  doc.text("Kink Compatibility Report", doc.internal.pageSize.getWidth() / 2, y, { align: "center" });
  y += 40;

  const data = window.compatibilityData || { categories: [] };

  for (const category of data.categories) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
    doc.text(category.name, colA, y);
    doc.setFontSize(12);
    doc.text("Partner A", colAScore, y);
    doc.text("Partner B", colBScore + 35, y);
    y += 28;

    for (const kink of category.kinks) {
      if (y > 500) {
        doc.addPage();
        doc.setFillColor(0, 0, 0);
        doc.rect(0, 0, doc.internal.pageSize.getWidth(), doc.internal.pageSize.getHeight(), "F");
        y = 40;
      }

      const label = shortenLabel(kink.label);
      const aScore = kink.partnerA ?? 0;
      const bScore = kink.partnerB ?? 0;
      const pct = 100 - Math.abs(aScore - bScore);
      const flag = getFlag(pct);

      doc.setFont("helvetica", "normal");
      doc.setTextColor(255, 255, 255);
      doc.text(label, colA, y);

      // Partner A score box
      doc.setDrawColor(255);
      doc.rect(colAScore, y - 12, 30, 18);
      doc.text(String(aScore), colAScore + 10, y);

      // Center compatibility bar
      const fillColor = pct >= 80 ? [0, 255, 0] : pct >= 60 ? [255, 255, 0] : [255, 0, 0];
      doc.setFillColor(...fillColor);
      doc.rect(colCenter, y - 10, barWidth, barHeight, "F");
      doc.setTextColor(255, 255, 255);
      doc.text(`${pct}% ${flag} +P`, colCenter + barWidth / 2, y + 5, { align: "center" });

      // Partner B score box
      doc.setDrawColor(255);
      doc.rect(colBScore, y - 12, 30, 18);
      doc.text(String(bScore), colBScore + 10, y);

      y += rowSpacing;
    }

    y += 20;
  }

  doc.save("kink_compatibility_report.pdf");
}

// Step 4: Hook it to your button
document.getElementById("downloadPDF").addEventListener("click", generateCompatibilityPDF);

