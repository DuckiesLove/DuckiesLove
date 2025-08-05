// PDF generation utility for compatibility report with shortened labels and match flags

// Map verbose kink labels to shorter versions for PDF output
export function shortenLabel(label) {
  const map = {
    "Choosing my partner’s outfit for the day or a scene": "Choose their outfit",
    "Selecting their underwear, lingerie, or base layers": "Pick their underwear",
    "Styling their hair (braiding, brushing, tying, etc.)": "Style their hair",
    "Picking head coverings (bonnets, veils, hoods, hats) for mood or protocol": "Head coverings",
    "Offering makeup, polish, or accessories as part of ritual or play": "Makeup or accessories",
    "Creating themed looks (slutty, innocent, doll-like, sharp, etc.)": "Themed looks",
    "Dressing them in role-specific costumes (maid, bunny, doll, etc.)": "Roleplay outfits",
    "Curating time-period or historical outfits (e.g., Victorian, 50s)": "Historical outfits",
    "Helping them present more femme, masc, or androgynous by request": "Femme/masc styling",
    "Coordinating their look with mine for public or private scenes": "Coordinated looks",
    "Implementing a “dress ritual” or aesthetic preparation": "Dress ritual",
    "Enforcing a visual protocol (e.g., no bra, heels required, tied hair)": "Visual protocol",
    "Having my outfit selected for me by a partner": "They choose my outfit",
    "Wearing the underwear or lingerie they choose": "They pick my lingerie",
    "Having my hair brushed, braided, tied, or styled for them": "Hair styling for them"
  };
  return map[label] || label;
}

// Determine match flags based on overall percentage and individual scores
function getMatchFlag(percent, scoreA, scoreB) {
  if (percent >= 90) return "⭐"; // star
  if (percent >= 85) return "🟩"; // green square
  if (percent <= 30) return "🚩"; // red flag
  if (scoreA === 5 && scoreB < 5) return "🟨"; // yellow square
  return "";
}

// Main function to build the PDF
export function generateCompatibilityPDF(data) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait' });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  let y = 20;

  // black background
  doc.setFillColor(0, 0, 0);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');

  // title
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.text('Kink Compatibility Report', pageWidth / 2, y, { align: 'center' });
  y += 10;

  for (const category of data.categories) {
    doc.setFontSize(14);
    doc.text(category.name, margin, y);
    y += 8;

    for (const item of category.items) {
      const shortLabel = shortenLabel(item.label || item.kink);
      const scoreA = item.partnerA;
      const scoreB = item.partnerB;
      const match = 100 - Math.abs(scoreA - scoreB) * 20;
      const flag = getMatchFlag(match, scoreA, scoreB);

      // label
      doc.setFontSize(11);
      doc.text(shortLabel, margin, y);

      // match bar
      const barX = pageWidth - 80;
      const barWidth = 50;
      const barHeight = 6;
      const fillColor = match >= 80 ? [0, 255, 0] : match >= 60 ? [255, 255, 0] : [255, 0, 0];
      doc.setFillColor(...fillColor);
      doc.rect(barX, y - 5, barWidth * (match / 100), barHeight, 'F');

      // percent and flag
      doc.setTextColor(255, 255, 255);
      doc.text(`${match.toFixed(0)}% ${flag}`, barX + barWidth + 5, y);

      y += 10;

      if (y > pageHeight - 20) {
        doc.addPage();
        doc.setFillColor(0, 0, 0);
        doc.rect(0, 0, pageWidth, pageHeight, 'F');
        y = 20;
      }
    }

    y += 5;
  }

  doc.save('kink-compatibility.pdf');
}

// Attach click handler to trigger PDF generation
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('downloadPdfBtn');
    if (btn) {
      btn.addEventListener('click', () => {
        if (!window.jspdf?.jsPDF) {
          alert("PDF library failed to load. Printing the page instead—choose 'Save as PDF' in your browser.");
          window.print();
          return;
        }
        if (!window.compatibilityData) {
          alert('No compatibility data found.');
          return;
        }
        generateCompatibilityPDF(window.compatibilityData);
      });
    }
  });
}

