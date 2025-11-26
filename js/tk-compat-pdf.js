// tk-compat-pdf.js

const TKCompatPDF = {
  generateFromStorage() {
    console.log('[compat-pdf] generateFromStorage() triggered');

    const selfRaw = localStorage.getItem('tk-survey-self');
    const partnerRaw = localStorage.getItem('tk-survey-partner');

    if (!selfRaw || !partnerRaw) {
      alert("Both partner surveys must be loaded.");
      return;
    }

    const self = JSON.parse(selfRaw);
    const partner = JSON.parse(partnerRaw);

    const selfData = self.byKink || {};
    const partnerData = partner.byKink || {};

    const rows = [];
    let totalItems = 0;
    let highMatches = 0;
    let totalMatchPct = 0;

    const seenKeys = new Set();

    for (const key in selfData) {
      if (!partnerData[key]) continue;
      if (seenKeys.has(key)) continue;

      const a = selfData[key];
      const b = partnerData[key];

      const scoreA = (typeof a === 'number') ? a : parseInt(a);
      const scoreB = (typeof b === 'number') ? b : parseInt(b);

      if (isNaN(scoreA) || isNaN(scoreB)) continue;

      const match = 100 - Math.abs(scoreA - scoreB) * 20;
      totalMatchPct += match;
      totalItems++;
      if (match >= 80) highMatches++;

      rows.push({
        key,
        scoreA,
        scoreB,
        match
      });

      seenKeys.add(key);
    }

    const avgMatch = totalItems ? Math.round(totalMatchPct / totalItems) : 0;

    TKCompatPDF.renderPDF(rows, {
      avgMatch,
      totalItems,
      highMatches
    });
  },

  renderPDF(dataRows, stats) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFontSize(22);
    doc.setTextColor(0, 255, 255);
    doc.text("TalkKink Compatibility", 105, 20, { align: "center" });

    doc.setFontSize(12);
    doc.setTextColor(200, 200, 200);
    doc.text(`Generated ${new Date().toLocaleString()}`, 105, 28, { align: "center" });

    // Summary Boxes
    doc.setDrawColor(0, 255, 255);
    doc.line(10, 30, 200, 30);
    doc.setFontSize(16);
    doc.setTextColor(0, 255, 255);

    doc.text(`Items Compared`, 20, 42);
    doc.text(`${stats.totalItems}`, 20, 36);

    doc.text(`Avg Match`, 95, 42);
    doc.text(`${stats.avgMatch}%`, 95, 36);

    doc.text(`80%+ Alignments`, 170, 42);
    doc.text(`${stats.highMatches}`, 170, 36);

    // Table Headers
    const headers = [["Category", "Partner A", "Match", "Partner B"]];
    const body = dataRows.map(row => [
      shortenLabel(row.key),
      row.scoreA.toString(),
      `${row.match}%`,
      row.scoreB.toString()
    ]);

    doc.autoTable({
      head: headers,
      body,
      startY: 50,
      styles: {
        textColor: [200, 255, 255],
        fontSize: 10
      },
      headStyles: {
        fillColor: [0, 70, 90],
        textColor: [0, 255, 255]
      },
      columnStyles: {
        0: { cellWidth: 70 },
        1: { cellWidth: 30 },
        2: { cellWidth: 30 },
        3: { cellWidth: 30 }
      }
    });

    doc.save("compatibility.pdf");
  }
};

function shortenLabel(label) {
  // Limit label length to fit PDF column
  return label.length > 25 ? label.slice(0, 24) + "…" : label;
}
