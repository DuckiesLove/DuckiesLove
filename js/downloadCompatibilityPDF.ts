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

  type Row = [string, number | "—", string | "—", number | "—"];

  function extractRows(table: HTMLTableElement): Row[] {
    const trs = Array.from(table.querySelectorAll("tr")).filter(
      (tr) => tr.querySelectorAll("th").length === 0 && tr.querySelectorAll("td").length > 0
    );

    return trs.map((tr) => {
      const cells = Array.from(tr.querySelectorAll("td")).map((td) =>
        (td.textContent || "")
          .replace(/\s+/g, " ")
          .replace(/([A-Za-z])\1+/g, "$1")
          .trim()
      );

      let category = cells[0] || "—";
      if (/^cum$/i.test(category)) category = "Cum Play";
      category = category.replace(/([A-Za-z]+)\s*\1/, "$1");

      const toNum = (v: unknown): number | null => {
        const n = Number(String(v ?? "").replace(/[^\d.-]/g, ""));
        return Number.isFinite(n) ? n : null;
      };
      const nums = cells.map(toNum).filter((n): n is number => n !== null);
      const A = nums.length ? nums[0] : null;
      const B = nums.length > 1 ? nums[nums.length - 1] : null;

      let pct = cells.find((c) => /%$/.test(c)) || null;
      if (!pct && A != null && B != null) {
        const p = Math.round(100 - (Math.abs(A - B) / 5) * 100);
        pct = `${Math.max(0, Math.min(100, p))}%`;
      }

      return [category, A ?? "—", pct ?? "—", B ?? "—"] as Row;
    });
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

    const originalAddPage = doc.addPage;
    doc.addPage = function patchedAddPage(this: typeof doc, ...args: any[]) {
      const result = originalAddPage.apply(this, args as any);
      paintBg();
      return result;
    } as typeof doc.addPage;

    try {
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
    } finally {
      doc.addPage = originalAddPage;
    }

    doc.save("compatibility-dark.pdf");
  } catch (err) {
    console.error("[TK-PDF] Export failed:", err);
    const msg = err instanceof Error ? err.message : String(err);
    alert("PDF export failed: " + msg);
  }
}

