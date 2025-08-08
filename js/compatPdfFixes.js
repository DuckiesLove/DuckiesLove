export function applyCompatLayoutAndFlags(root = document.getElementById('pdf-container')) {
  if (!root) return;

  // Inject style once
  if (!document.getElementById('compat-pdf-fixes')) {
    const style = document.createElement('style');
    style.id = 'compat-pdf-fixes';
    style.textContent = `
  /* Dark theme + reliable widths */
  #pdf-container { background:#000; color:#fff; }
  #pdf-container table.compat { width:100%; table-layout:fixed; border-collapse:collapse; color:#fff; background:#000; }
  #pdf-container table.compat th,
  #pdf-container table.compat td { padding:10px 12px; vertical-align:top; word-break:break-word; }

  /* Even column widths: [Label | A | Match | Flag | B] */
  #pdf-container table.compat col.label { width:52%; }
  #pdf-container table.compat col.pa    { width:12%; }
  #pdf-container table.compat col.match { width:8%;  }
  #pdf-container table.compat col.flag  { width:8%;  }
  #pdf-container table.compat col.pb    { width:12%; }

  /* Remove the "Kink" header label cell text */
  #pdf-container table.compat thead th:first-child { color:transparent; }

  /* Category title row (spans all columns) */
  #pdf-container .category-title {
    font-weight:800; font-size:1.2rem;
    border-top:2px solid #333; border-bottom:2px solid #333;
    padding:14px 12px !important;
  }

  /* Keep a whole category (title + items) together on one page */
  #pdf-container tbody.category-block { break-inside:avoid; page-break-inside:avoid; }

  /* Print: keep true black background */
  @media print {
    body{ background:#000; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  }
    `;
    document.head.appendChild(style);
  }

  // 1) Ensure all tables are marked and have a colgroup with our widths
  root.querySelectorAll('table').forEach((t) => {
    if (!t.classList.contains('compat')) t.classList.add('compat');
    if (!t.querySelector('colgroup')) {
      const cg = document.createElement('colgroup');
      cg.innerHTML = `
        <col class="label">
        <col class="pa">
        <col class="match">
        <col class="flag">
        <col class="pb">
      `;
      t.insertBefore(cg, t.firstChild);
    }
    const headFirst = t.querySelector('thead th:first-child');
    if (headFirst) headFirst.textContent = '';
  });

  // 2) Group rows by category to prevent page splits
  root.querySelectorAll('table.compat').forEach((table) => {
    const tbodies = Array.from(table.tBodies);
    if (!tbodies.length) return;
    const allRows = tbodies.flatMap(tb => Array.from(tb.rows));
    tbodies.forEach(tb => tb.remove());
    let currentBlock = document.createElement('tbody');
    currentBlock.className = 'category-block';
    table.appendChild(currentBlock);
    allRows.forEach((row) => {
      const isCategoryTitle = row.classList.contains('category-title') ||
        (row.cells.length === 1 && row.cells[0].colSpan >= 5);
      if (isCategoryTitle) {
        currentBlock = document.createElement('tbody');
        currentBlock.className = 'category-block';
        table.appendChild(currentBlock);
        row.classList.add('category-title');
      }
      currentBlock.appendChild(row);
    });
  });

  // 3) Render flags only when A and B differ
  const FLAG_DIFF_THRESHOLD = 0;
  function parseNum(text) {
    const n = Number(String(text).trim().replace(/[^\d.-]/g,''));
    return Number.isFinite(n) ? n : null;
  }
  root.querySelectorAll('table.compat tbody.category-block tr').forEach((row) => {
    const isTitle = row.classList.contains('category-title') ||
      (row.cells.length === 1 && row.cells[0].colSpan >= 5);
    if (isTitle || row.cells.length < 5) return;
    const aCell = row.cells[1];
    const mCell = row.cells[2];
    const fCell = row.cells[3];
    const bCell = row.cells[4];
    if (mCell) mCell.textContent = '—';
    if (fCell) fCell.textContent = '';
    const a = parseNum(aCell && aCell.textContent);
    const b = parseNum(bCell && bCell.textContent);
    if (a == null || b == null) return;
    const diff = Math.abs(a - b);
    if (diff <= FLAG_DIFF_THRESHOLD) {
      if (mCell) mCell.textContent = '✓';
    } else {
      if (mCell) mCell.textContent = '—';
      if (fCell) {
        const span = document.createElement('span');
        span.textContent = '🚩';
        span.style.color = '#ff4d4f';
        fCell.appendChild(span);
      }
    }
  });

  // 4) Ensure container is full-width black
  Object.assign(root.style, {
    backgroundColor: '#000',
    color: '#fff',
    width: '100%',
    maxWidth: '100%',
    margin: '0',
    padding: '0',
    overflow: 'visible'
  });
}
