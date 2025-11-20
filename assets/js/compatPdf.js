    // Use embedded Space Grotesk only; avoid any external font fetches (offline-safe)
      normal: null,
      bold: null,
  function formatMatchDisplay(matchPercent, aScore, bScore) {
    const percent = Number.isFinite(matchPercent)
      ? Math.round(matchPercent)
      : computeMatchPercent(null, aScore, bScore);

    if (!Number.isFinite(percent)) {
      return { text: safeString(matchPercent), icon: "" };
    }

    const diff = Math.abs((aScore ?? 0) - (bScore ?? 0));
    let emoji = "";
    if (percent >= 90) emoji = "⭐";
    else if (percent <= 30) emoji = "🚩";
    else if ((aScore === 5 || bScore === 5) && diff > 1) emoji = "🟨";

    const text = `${percent}%${emoji ? ` ${emoji}` : ""}`;
    return { text, icon: emoji };
      const match = formatMatchDisplay(r.matchPercent, r.aScore, r.bScore);
      if (match.icon === "⭐") stars += 1;
      const matchDisplay = formatMatchDisplay(r.matchPercent, r.aScore, r.bScore);
      const matchText = matchDisplay.text || safeString(r.matchText);
      const matchIcon = matchDisplay.icon || "";
    const subtitleY = titleY + 16;
    const pillHeight = 38;
    doc.setFontSize(22);
    doc.setFontSize(10);
    doc.setFontSize(18);
      { header: "Match", dataKey: "match" },
    doc.save("TalkKink_Compatibility_Report.pdf");
