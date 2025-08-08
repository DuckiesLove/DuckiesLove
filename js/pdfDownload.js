export function exportToPDF() {
  const container = document.getElementById('pdf-container');
  if (!container) {
    alert('PDF content not found.');
    return;
  }

// ✅ Unified: Full-page black styling, table formatting, and layout fix

const container = document.getElementById("pdf-container");
container.style.width = "100%";
container.style.maxWidth = "100%";
container.style.backgroundColor = "#000";
container.style.color = "#fff";
container.style.padding = "0";
container.style.margin = "0";
container.style.overflow = "visible";

// Normalize all tables
const tables = container.querySelectorAll("table");
tables.forEach((table) => {
  table.style.backgroundColor = "#000";
  table.style.width = "100%";
  table.style.tableLayout = "fixed";

  const cells = table.querySelectorAll("th, td");
  cells.forEach((cell) => {
    cell.style.color = "#fff";
    cell.style.padding = "8px";
    cell.style.boxSizing = "border-box";
  });
});

    const cells = table.querySelectorAll('th, td');
    cells.forEach(cell => {
      cell.style.color = '#fff';
      cell.style.padding = '8px';
      cell.style.boxSizing = 'border-box';
    });
  });

const container = document.getElementById("pdf-container");

Object.assign(container.style, {
  width: "100%",
  maxWidth: "100%",
  backgroundColor: "#000",
  color: "#fff",
  padding: "0",
  margin: "0",
  overflow: "visible"
});

const tables = container.querySelectorAll("table");
tables.forEach(table => {
  Object.assign(table.style, {
    backgroundColor: "#000",
    width: "100%",
    tableLayout: "fixed",
    borderCollapse: "collapse"
  });

  const cells = table.querySelectorAll("th, td");
  cells.forEach(cell => {
    Object.assign(cell.style, {
      color: "#fff",
      boxSizing: "border-box",
      padding: "8px",
      lineHeight: "1.2",
      wordBreak: "break-word",
      whiteSpace: "normal",
      verticalAlign: "top"
    });
  });
});

container.querySelectorAll("tr").forEach(row => {
  const cells = row.children;
  if (cells.length >= 5) {
    cells[1].style.paddingLeft = "48px";
    cells[2].style.paddingLeft = "24px";
    cells[3].style.paddingLeft = "24px";
    cells[4].style.paddingLeft = "24px";
  }
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

document.body.style.margin = "0";
document.documentElement.style.margin = "0";

html2pdf().set({
  margin: 0,
  filename: "kink-compatibility.pdf",
  image: { type: "jpeg", quality: 1 },
  html2canvas: {
    backgroundColor: "#000",
    scale: 2,
    useCORS: true
  },
  jsPDF: {
    unit: "pt",
    format: "letter",
    orientation: "portrait"
  }
}).from(container).save();


export const exportKinkCompatibilityPDF = exportToPDF;

if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    const downloadBtn = document.getElementById('downloadPdfBtn');
    if (!downloadBtn) return;
    downloadBtn.addEventListener('click', exportToPDF);
  });
}

