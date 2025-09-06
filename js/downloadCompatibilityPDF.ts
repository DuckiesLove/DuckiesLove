export async function downloadCompatibilityPDF(): Promise<void> {
  const loadScript = (src: string): Promise<void> =>
    new Promise((resolve, reject) => {
      if (document.querySelector<HTMLScriptElement>(`script[src="${src}"]`)) return resolve();
      const s = document.createElement("script");
      s.src = src;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("Failed to load " + src));
      document.head.appendChild(s);
    });

  async function ensureLibs(): Promise<void> {
    const hasJsPDF = () => Boolean((window as any).jspdf?.jsPDF || (window as any).jsPDF);
    if (!hasJsPDF()) {
      await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
    }

    const hasAutoTable = () =>
      Boolean(
        (window as any).jspdf?.autoTable ||
          (window as any).jspdf?.jsPDF?.API?.autoTable ||
          (window as any).jsPDF?.API?.autoTable
      );
    if (!hasAutoTable()) {
      await loadScript(
        "https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.3/jspdf.plugin.autotable.min.js"
      );
    }
  }

  const tidy = (s: string | null | undefined): string => (s || "").replace(/\s+/g, " ").trim();

  const toNum = (v: unknown): number | null => {
    const n = Number(String(v ?? "").replace(/[^\d.-]/g, ""));
    return Number.isFinite(n) ? n : null;
    };

  type Row = [string, number | "—", string | "—", number | "—"];

  const isValidScore = (n: number | null): boolean =>
    Number.isInteger(n) && (n as number) >= 1 && (n as number) <= 5;

  function extractRows(table: HTMLTableElement): Row[] {
    // rows that have <td> cells (some sites use <td> for headers)
    const trs = Array.from(table.querySelectorAll("tr")).filter(
      (tr) => tr.querySelectorAll("td").length > 0
    );

    const isHeaderLike = (cellTexts: string[]): boolean => {
      const first = (cellTexts[0] || "").toLowerCase();
      const joined = cellTexts.map((t) => (t || "").toLowerCase()).join(" | ");
      if (first === "category") return true;
      if (/partner a|partner b|match/.test(joined)) return true;
      if (!cellTexts.some((t) => /\S/.test(t))) return true;
      return false;
    };

    const rows: Row[] = [];

    for (const tr of trs) {
      const cells = Array.from(tr.querySelectorAll("td")).map((td) => tidy(td.textContent));
      if (!cells.length) continue;
      if (isHeaderLike(cells)) continue;

      const category = cells[0] || "—";

      const numeric = cells.map(toNum).filter((n): n is number => n !== null);
      const Araw = numeric.length ? numeric[0] : null;
      const Braw = numeric.length ? numeric[numeric.length - 1] : null;

      const aValid = isValidScore(Araw);
      const bValid = isValidScore(Braw);

      let pct = cells.find((c) => /%$/.test(c)) || null;
      if (!pct && aValid && bValid && Araw !== null && Braw !== null) {
        const p = Math.round(100 - (Math.abs(Araw - Braw) / 5) * 100);
        pct = `${Math.max(0, Math.min(100, p))}%`;
      }
      if (!pct) pct = "—";

      const A: number | "—" = aValid && Araw !== null ? Araw : "—";
      const B: number | "—" = bValid && Braw !== null ? Braw : "—";

      rows.push([category, A, pct, B]);
    }

    return rows;
  }

  try {
    await ensureLibs();
    const JsPDF: any = (window as any).jspdf?.jsPDF || (window as any).jsPDF;
    const table =
      document.querySelector<HTMLTableElement>("#compatibilityTable") ||
      document.querySelector<HTMLTableElement>(".results-table.compat") ||
      document.querySelector<HTMLTableElement>("table");
    if (!table) {
      alert("No table found on the page.");
      return;
    }
    const body = extractRows(table);
    if (!body.length) {
      alert("No rows to export.");
      return;
    }

    const doc = new JsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();

    const paintBg = (): void => {
      doc.setFillColor(0, 0, 0);
      doc.rect(0, 0, pageW, pageH, "F");
      doc.setTextColor(255, 255, 255);
    };

    paintBg();
    doc.setFontSize(24);
    doc.text("Talk Kink • Compatibility Report", pageW / 2, 42, { align: "center" });

    const marginLR = 30;
    const usable = pageW - marginLR * 2;
    const Awidth = 90,
      Mwidth = 110,
      Bwidth = 90;
    const CatWidth = Math.max(220, usable - (Awidth + Mwidth + Bwidth));

    const runAT = (opts: Record<string, unknown>): void => {
      if (typeof doc.autoTable === "function") return doc.autoTable(opts);
      if ((window as any).jspdf && typeof (window as any).jspdf.autoTable === "function")
        return (window as any).jspdf.autoTable(doc, opts);
      throw new Error("AutoTable not available");
    };

    runAT({
      head: [["Category", "Partner A", "Match %", "Partner B"]],
      body,
      startY: 64,
      margin: { left: marginLR, right: marginLR, top: 64, bottom: 40 },
      styles: {
        fontSize: 11,
        cellPadding: 6,
        textColor: [255, 255, 255],
        fillColor: [0, 0, 0],
        lineColor: [255, 255, 255],
        lineWidth: 1.2,
        halign: "center",
        valign: "middle",
      },
      headStyles: {
        fillColor: [0, 0, 0],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        lineColor: [255, 255, 255],
        lineWidth: 1.6,
      },
      bodyStyles: {
        fillColor: [0, 0, 0],
        textColor: [255, 255, 255],
      },
      alternateRowStyles: {
        fillColor: [0, 0, 0],
        textColor: [255, 255, 255],
      },
      columnStyles: {
        0: { cellWidth: CatWidth, halign: "left" },
        1: { cellWidth: Awidth, halign: "center" },
        2: { cellWidth: Mwidth, halign: "center" },
        3: { cellWidth: Bwidth, halign: "center" },
      },
      tableWidth: usable,
      willDrawPage: paintBg,
    });

    doc.save("compatibility-dark.pdf");
  } catch (err) {
    console.error("[TK-PDF] Export failed:", err);
    const msg = err instanceof Error ? err.message : String(err);
    alert("PDF export failed: " + msg);
  }
}

