export function exportToPDF() {
  const container = document.getElementById("pdf-container");
  if (!container) {
    alert("PDF content not found.");
    return;
  }

  const fullWidth = container.scrollWidth;

  Object.assign(container.style, {
    width: `${fullWidth}px`,
    maxWidth: "100%",
    backgroundColor: "#000",
    color: "#fff",
    margin: "0",
    padding: "0",
    overflow: "visible",
  });

  container.querySelectorAll("table").forEach(table => {
    Object.assign(table.style, {
      width: "100%",
      tableLayout: "fixed",
      borderCollapse: "collapse",
      backgroundColor: "#000",
      color: "#fff",
    });

    table.querySelectorAll("th, td").forEach(cell => {
      Object.assign(cell.style, {
        boxSizing: "border-box",
        padding: "4px",
        lineHeight: "1.2",
        wordBreak: "break-word",
        whiteSpace: "normal",
        verticalAlign: "top",
        color: "#fff",
      });
    });
  });

  function equalizeRowHeights() {
    const sectionTables = document.querySelectorAll(".compat-section table");
    const maxRows = Math.max(0, ...Array.from(sectionTables).map(t => t.rows.length));

    for (let rowIndex = 0; rowIndex < maxRows; rowIndex++) {
      let maxHeight = 0;
      sectionTables.forEach(table => {
        const row = table.rows[rowIndex];
        if (row) {
          row.style.height = "auto";
          const height = row.offsetHeight;
          if (height > maxHeight) maxHeight = height;
        }
      });
      sectionTables.forEach(table => {
        const row = table.rows[rowIndex];
        if (row) row.style.height = `${maxHeight}px`;
      });
    }
  }
  equalizeRowHeights();

  container.querySelectorAll("tr").forEach(row => {
    const cells = row.children;
    if (cells.length >= 5) {
      cells[1].style.paddingLeft = "48px";
      cells[2].style.paddingLeft = "24px";
      cells[3].style.paddingLeft = "24px";
      cells[4].style.paddingLeft = "24px";
    }
  });

  document.body.style.margin = "0";
  document.documentElement.style.margin = "0";

  html2pdf()
    .set({
      margin: 0,
      filename: "kink-compatibility.pdf",
      image: { type: "jpeg", quality: 1 },
      html2canvas: {
        backgroundColor: "#000",
        scale: 2,
        useCORS: true,
        scrollX: 0,
        scrollY: 0,
        windowWidth: fullWidth,
      },
      jsPDF: {
        unit: "in",
        format: "letter",
        orientation: "landscape",
      },
      pagebreak: { mode: ["avoid-all", "css", "legacy"] },
    })
    .from(container)
    .save();
}

export const exportKinkCompatibilityPDF = exportToPDF;

if (typeof window !== "undefined") {
  window.addEventListener("DOMContentLoaded", () => {
    const downloadBtn = document.getElementById("downloadPdfBtn");
    if (downloadBtn) {
      downloadBtn.addEventListener("click", exportToPDF);
    }
  });
}

