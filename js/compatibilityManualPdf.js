// \u2705 FULL PATCHED CODE \u2014 FIXES &&& ISSUE + COLUMN FITTING

/**
 * 1. \ud83d\udee0\ufe0f Fixes "&&&" display by checking if values are valid numbers before formatting.
 * 2. \ud83d\udccf Adjusts kink/category label widths so they fit the table layout cleanly.
 * 3. \ud83d\udc85 Aligns Partner A, Match %, and Partner B under appropriate headers.
 */

function generateCompatPDF(partnerA, partnerB, comparisonResults) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const width = doc.internal.pageSize.getWidth();

  const now = new Date();
  const timestamp = now.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const margin = 40;
  const lineHeight = 20;

  // Colors and fonts
  const primaryColor = "#00e0ff";
  const fontSize = 14;
  const headerFontSize = 28;
  const statFontSize = 18;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(headerFontSize);
  doc.setTextColor(primaryColor);
  doc.text("TalkKink Compatibility", margin, 60);

  doc.setFontSize(12);
  doc.text(`Generated ${timestamp}`, margin, 80);
  doc.setDrawColor(primaryColor);
  doc.setLineWidth(1.5);
  doc.line(margin, 90, width - margin, 90);

  // Summary boxes
  const statY = 110;
  const boxW = 150;
  const gap = 40;

  const statBox = (label, value, x) => {
    doc.setFontSize(statFontSize);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(primaryColor);
    doc.text(`${value}`, x, statY + 20);
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.setTextColor("#ffffff");
    doc.text(label, x, statY + 40);
  };

  statBox("Items Compared", comparisonResults.length, margin);
  statBox("Avg Match", `${Math.round(getAvgMatch(comparisonResults))}%`, margin + boxW + gap);
  statBox("80%+ Alignments", countHighMatches(comparisonResults), margin + 2 * (boxW + gap));

  // Table headers
  const tableY = statY + 80;
  const colWidths = {
    item: 360,
    partnerA: 70,
    match: 70,
    partnerB: 70,
  };

  const colX = {
    item: margin,
    partnerA: margin + colWidths.item + 10,
    match: margin + colWidths.item + 10 + colWidths.partnerA + 10,
    partnerB: margin + colWidths.item + 10 + colWidths.partnerA + 10 + colWidths.match + 10,
  };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(fontSize);
  doc.setTextColor(primaryColor);
  doc.text("Item", colX.item, tableY);
  doc.text("Partner A", colX.partnerA, tableY);
  doc.text("Match", colX.match, tableY);
  doc.text("Partner B", colX.partnerB, tableY);

  let y = tableY + 10;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(fontSize);
  doc.setTextColor("#ffffff");

  for (const row of comparisonResults) {
    const label = shortenKink(row.kink);
    const a = formatScore(row.a);
    const b = formatScore(row.b);
    const match = formatMatch(row.match);

    y += lineHeight;
    doc.text(label, colX.item, y, { maxWidth: colWidths.item });
    doc.text(a, colX.partnerA, y);
    doc.text(match, colX.match, y);
    doc.text(b, colX.partnerB, y);
  }

  doc.save("TalkKink-Compatibility.pdf");

  // --- Helper Functions ---

  function formatScore(score) {
    return Number.isFinite(score) ? `${score}` : "N/A";
  }

  function formatMatch(match) {
    return Number.isFinite(match) ? `${Math.round(match)}%` : "N/A";
  }

  function getAvgMatch(rows) {
    const validMatches = rows.filter(r => Number.isFinite(r.match));
    const sum = validMatches.reduce((acc, r) => acc + r.match, 0);
    return validMatches.length ? sum / validMatches.length : 0;
  }

  function countHighMatches(rows) {
    return rows.filter(r => Number.isFinite(r.match) && r.match >= 80).length;
  }

  function shortenKink(label) {
    return label
      .replace(/Giving: /, "G: ")
      .replace(/Receiving: /, "R: ")
      .replace(/\(.*?\)/g, "")
      .replace(/Body Part Torture/, "BPT")
      .trim();
  }
}
