// Generate a compatibility PDF with score columns and match flags

// Map verbose kink labels to shorter versions for PDF output
export function shortenLabel(label) {
  const map = {
    "Choosing my partner’s outfit for the day or a scene": "Choose outfit",
    "Selecting their underwear, lingerie, or base layers": "Underwear",
    "Styling their hair (braiding, brushing, tying, etc.)": "Style hair",
    "Picking head coverings (bonnets, veils, hoods, hats) for mood or protocol": "Headwear",
    "Offering makeup, polish, or accessories as part of ritual or play": "Makeup/accessories",
    "Creating themed looks (slutty, innocent, doll-like, sharp, etc.)": "Themed looks",
    "Dressing them in role-specific costumes (maid, bunny, doll, etc.)": "Roleplay outfits",
    "Curating time-period or historical outfits (e.g., Victorian, 50s)": "Historical outfits",
    "Helping them present more femme, masc, or androgynous by request": "Femme/masc styling",
    "Coordinating their look with mine for public or private scenes": "Coordinated looks",
    "Implementing a “dress ritual” or aesthetic preparation": "Dress ritual",
    "Enforcing a visual protocol (e.g., no bra, heels required, tied hair)": "Visual protocol",
    "Having my outfit selected for me by a partner": "They pick my outfit",
    "Wearing the underwear or lingerie they choose": "They pick my lingerie",
    "Having my hair brushed, braided, tied, or styled for them": "Hair for them",
  };
  return map[label] || label;
}

// Determine match flags based on overall percentage and individual scores
function getMatchFlag(percent, a, b) {
  if (percent >= 90) return "⭐";
  if (percent >= 85) return "🟩";
  if (percent <= 30) return "🚩";
  if (a === 5 && b < 5) return "🟨";
  return "";
}

// Main function to build the PDF
export function generateCompatibilityPDF(data) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;
  let y = 15;

  // black background
  doc.setFillColor(0, 0, 0);
  doc.rect(0, 0, pageWidth, pageHeight, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.text("Kink Compatibility Report", pageWidth / 2, y, { align: "center" });
  y += 10;

  doc.setFontSize(12);
  doc.text("Kink", margin, y);
  doc.text("A", pageWidth - 70, y);
  doc.text("B", pageWidth - 50, y);
  doc.text("%", pageWidth - 30, y);
  y += 7;

  for (const category of data.categories) {
    doc.setTextColor(100, 150, 255);
    doc.setFontSize(13);
    doc.text(category.name, margin, y);
    y += 6;

    for (const item of category.items) {
      const label = shortenLabel(item.label || item.kink || "");
      const a = item.partnerA ?? 0;
      const b = item.partnerB ?? 0;
      const percent = 100 - Math.abs(a - b) * 20;
      const flag = getMatchFlag(percent, a, b);

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(11);
      doc.text(label, margin, y);
      doc.text(String(a), pageWidth - 70, y);
      doc.text(String(b), pageWidth - 50, y);
      doc.text(`${percent}% ${flag}`, pageWidth - 30, y);
      y += 6;

      if (y > pageHeight - 20) {
        doc.addPage();
        doc.setFillColor(0, 0, 0);
        doc.rect(0, 0, pageWidth, pageHeight, "F");
        y = 15;
      }
    }
    y += 4;
  }

  doc.save("kink-compatibility.pdf");
}

// Attach click handler to trigger PDF generation
if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("downloadPdfBtn");
    if (btn) {
      btn.addEventListener("click", () => {
        if (!window.jspdf?.jsPDF) {
          alert(
            "PDF library failed to load. Printing the page instead—choose 'Save as PDF' in your browser."
          );
          window.print();
          return;
        }

        if (!window.compatibilityData) {
          alert("No compatibility data found.");
          return;
        }

        generateCompatibilityPDF(window.compatibilityData);
      });
    }
  });
}

