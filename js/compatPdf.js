 * - Match column shows percentage with ⭐ for 90%+ and 🚩 for 30% or below
  const TABLE_BG = [11, 30, 38];
  const GRID = [0, 208, 255];
  const REMOTE_FONT_SOURCES = {};
  const DEFAULT_FONT_FAMILY = "helvetica";
    if (matchPercent >= 90) return "⭐";
    if (matchPercent <= 30) return "🚩";
    return "";
  }

  function buildMatchIconPayload(symbol) {
    if (!symbol) return null;
    if (symbol === "⭐") return { glyph: "⭐", fallback: "[★]" };
    if (symbol === "🚩") return { glyph: "🚩", fallback: "[!]" };
    if (symbol === "★") return { glyph: "⭐", fallback: "[★]" };
    return { glyph: symbol, fallback: "" };
      if (star === "⭐") stars += 1;
      let matchIcon = null;
        matchIcon = buildMatchIconPayload(getMatchEmoji(r.matchPercent));
        if (matchText.includes("🚩")) matchIcon = buildMatchIconPayload("🚩");
        else if (matchText.includes("🟨")) matchIcon = buildMatchIconPayload("🟨");
        else if (matchText.includes("⭐") || matchText.includes("★")) {
          matchIcon = buildMatchIconPayload("⭐");
        }
    const glyph = typeof icon === "string" ? icon : icon?.glyph || "";
    const fallback = typeof icon === "object" ? icon.fallback || "" : "";

      glyph === "🚩"
        : glyph === "🟨"

    if (glyph === "⭐") {
      drawStarShape(doc, frame);
      return;
    }

    if (glyph === "🚩") {
      const poleHeight = iconSize;
      const poleWidth = iconSize * 0.14;
      const flagWidth = iconSize * 0.7;
      const poleX = frame.x + iconSize / 2 - poleWidth / 2;
      const poleY = frame.y + (iconSize - poleHeight);

      doc.setFillColor(...iconColor);
      doc.setDrawColor(...iconColor);
      doc.setLineWidth(0.6);

      doc.rect(poleX, poleY, poleWidth, poleHeight, "F");
      drawPolygon(
        doc,
        [
          [poleX + poleWidth, poleY],
          [poleX + poleWidth + flagWidth, poleY + poleHeight * 0.2],
          [poleX + poleWidth, poleY + poleHeight * 0.4],
        ],
        "F",
      );
      return;
    }

    const iconText = glyph || fallback;
    if (!iconText) return;

    doc.text(iconText, frame.x + iconSize / 2, frame.y + iconSize - 2, {
    segments.push({ icon: buildMatchIconPayload("⭐"), text: `90–100% matches: ${stats.stars}` });
    const tableHeaders = [
      { content: "Kinks", styles: { halign: "left" } },
      { content: "Partner A", styles: { halign: "center" } },
      { content: "Match %", styles: { halign: "center" } },
      { content: "Partner B", styles: { halign: "center" } },
    ];
      head: [tableHeaders],
        fontSize: 9,
        cellPadding: 2.5,
        textColor: [255, 255, 255],
        lineWidth: 0.2,
        fontStyle: "bold",
        fontSize: 10,
        lineWidth: 0.2,
        cellPadding: { top: 4, bottom: 4, left: 6, right: 6 },
          cellPadding: { top: 3, bottom: 3, left: 12, right: 8 },
          cellPadding: { top: 3, bottom: 3, left: 6, right: 10 },
