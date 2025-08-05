// Dark-themed compatibility PDF generator for TalkKink
// Builds a standalone PDF using jsPDF when the "Download PDF" button is clicked.

(function() {
  // Initialize jsPDF from the global window object
  const { jsPDF } = window.jspdf || {};

  // Map of long kink labels to shortened versions used in the PDF
  const shortenedLabels = {
    "Choosing my partner’s outfit for the day or a scene": "Choosing outfit",
    "Selecting their underwear, lingerie, or base layers": "Picking underwear",
    "Styling their hair (braiding, brushing, tying, etc.)": "Styling hair",
    "Picking head coverings (bonnets, veils, hoods, hats) for mood or protocol": "Head coverings",
    "Offering makeup, polish, or accessories as part of ritual or play": "Makeup/accessories",
    "Creating themed looks (slutty, innocent, doll-like, sharp, etc.)": "Themed looks",
    "Dressing them in role-specific costumes (maid, bunny, doll, etc.)": "Roleplay outfits",
    "Curating time-period or historical outfits (e.g., Victorian, 50s)": "Historical outfits",
    "Helping them present more femme, masc, or androgynous by request": "Femme/masc styling",
    "Coordinating their look with mine for public or private scenes": "Coordinated outfits",
    "Implementing a “dress ritual” or aesthetic preparation": "Dress ritual",
    "Enforcing a visual protocol (e.g., no bra, heels required, tied hair)": "Visual protocol",
    "Having my outfit selected for me by a partner": "Partner-picked outfit",
    "Wearing the underwear or lingerie they chose": "Chosen lingerie",
    "Having my hair brushed, braided, tied, or styled for them": "Hair brushed/styled",
    "Putting on a head covering (e.g., bonnet, veil, hood) they chose": "Head covering worn",
    "Following visual appearance rules as part of submission": "Appearance rules"
    // Add more if needed
  };

  // Determine which symbol to display based on compatibility percentage
  const getFlag = (match) => {
    if (match === 100) return '⭐';
    if (match >= 80) return '🟩';
    if (match <= 50) return '🚩';
    return '';
  };

  // Bar colour depending on compatibility percentage
  const getBarColor = (match) => {
    if (match >= 80) return '#00FF00';
    if (match >= 60) return '#FFFF00';
    return '#FF4444';
  };

  // Draw a white outlined score box with black fill and white text
  const drawScoreBox = (doc, score, x, y, cfg) => {
    doc.setDrawColor(255);
    doc.setFillColor(0);
    doc.rect(x, y, cfg.scoreBoxWidth, cfg.barHeight);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.text(String(score ?? '-'), x + cfg.scoreBoxWidth / 2, y + 5, { align: 'center' });
  };

  // Draw the compatibility bar and percentage text
  const drawBar = (doc, percent, x, y, color, cfg) => {
    doc.setFillColor(color);
    const filled = (cfg.barWidth * percent) / 100;
    doc.rect(x, y, filled, cfg.barHeight, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.text(`${percent}%`, x + cfg.barWidth + 4, y + 5);
  };

  // Paint a solid black background for the current page
  const drawBlackBackground = (doc) => {
    const width = doc.internal.pageSize.getWidth();
    const height = doc.internal.pageSize.getHeight();
    doc.setFillColor(0, 0, 0);
    doc.rect(0, 0, width, height, 'F');
  };

  // Create a new page when content would overflow
  const addPageIfNeeded = (doc, state) => {
    if (state.y + 20 > state.pageHeight) {
      doc.addPage();
      drawBlackBackground(doc);
      state.y = state.margin;
    }
  };

  // If the font cannot render the emoji flag, fall back to ASCII symbols
  const safeFlag = (doc, symbol) => {
    if (!symbol) return '';
    if (doc.getTextWidth(symbol) === 0) {
      if (symbol === '⭐') return '*';
      if (symbol === '🟩') return '#';
      if (symbol === '🚩') return '!';
    }
    return symbol;
  };

  function generateCompatibilityPDF() {
    console.log('PDF function triggered');
    if (!jsPDF || window.jspdf?.isStub) {
      alert('Unable to load PDF generator. Please try again later.');
      return;
    }

    const doc = new jsPDF('portrait', 'mm', 'a4');
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    let y = margin;

    const config = {
      colA: 20,
      colB: 180,
      centerBarX: 105,
      scoreBoxWidth: 18,
      barWidth: 50,
      barHeight: 7,
      fontSize: 11,
      lineHeight: 10,
      sectionSpacing: 6,
    };

    drawBlackBackground(doc);

    // Reserve first page for table of contents, generate content starting on page 2
    doc.addPage();
    drawBlackBackground(doc);
    y = margin;

    const toc = [];
    const data = window.compatibilityData || { categories: [] };

    for (const cat of data.categories) {
      addPageIfNeeded(doc, { y, pageHeight, margin });
      const currentPage = doc.internal.getNumberOfPages();
      toc.push({ name: cat.name, page: currentPage });

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.text(cat.name, config.colA, y);
      y += config.lineHeight;

      const items = [...(cat.items || cat.kinks || [])].sort((a, b) => {
        const matchA = 100 - Math.abs((a.partnerA ?? 0) - (a.partnerB ?? 0)) * 20;
        const matchB = 100 - Math.abs((b.partnerA ?? 0) - (b.partnerB ?? 0)) * 20;
        return matchB - matchA;
      });

      for (const item of items) {
        addPageIfNeeded(doc, { y, pageHeight, margin });
        const rawLabel = item.kink || item.label || item.name;
        const label = shortenedLabels[rawLabel] || rawLabel;
        const a = item.partnerA ?? '-';
        const b = item.partnerB ?? '-';
        const match = 100 - Math.abs((a ?? 0) - (b ?? 0)) * 20;
        const flag = safeFlag(doc, getFlag(match));
        const barColor = getBarColor(match);

        doc.setFontSize(config.fontSize);
        doc.setTextColor(255, 255, 255);
        doc.text(String(label ?? ''), config.colA, y);

        drawScoreBox(doc, a, config.colA + 80, y - 6, config);
        drawBar(doc, match, config.centerBarX - config.barWidth / 2, y - 6, barColor, config);
        doc.text(flag, config.centerBarX + config.barWidth / 2 + 10, y);
        drawScoreBox(doc, b, config.colB - config.scoreBoxWidth, y - 6, config);

        y += config.lineHeight;
      }

      y += config.sectionSpacing;
    }

    // Populate the table of contents on the first page
    doc.setPage(1);
    drawBlackBackground(doc);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.text('Kink Compatibility Report', 105, margin, { align: 'center' });
    let tocY = margin + 15;
    doc.setFontSize(12);
    doc.text('Table of Contents', margin, tocY);
    tocY += config.lineHeight;
    for (const entry of toc) {
      doc.text(entry.name, margin, tocY);
      doc.text(String(entry.page), 210 - margin, tocY, { align: 'right' });
      tocY += config.lineHeight;
    }

    doc.save('talkkink_compatibility_report.pdf');
  }

  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('downloadPdfBtn');
    if (btn) {
      btn.addEventListener('click', generateCompatibilityPDF);
    } else {
      console.error('Download button not found');
    }
  });
})();
