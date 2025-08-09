/* Restore full-width column layout for PDF after removing Flag */
(function(){
  if(document.querySelector('style[data-pdf-fix]')) return;
  const css = `
    .pdf-export table {
      table-layout: fixed;
      width: 100%;
    }
    .pdf-export th, .pdf-export td {
      padding: 6px;
      vertical-align: top;
    }
    /* Category column wider for long text */
    .pdf-export .col-category {
      width: 60% !important;
      text-align: left !important;
      white-space: normal !important;
    }
    /* Partner A, Match, Partner B evenly spaced */
    .pdf-export .col-a,
    .pdf-export .col-match,
    .pdf-export .col-b {
      width: 13.33% !important;
      text-align: center !important;
      white-space: nowrap !important;
    }
  `;
  const s = document.createElement('style');
  s.setAttribute('data-pdf-fix','true');
  s.textContent = css;
  document.head.appendChild(s);
})();

export function removeFlagColumn(table) {
  const headRow = table.querySelector('thead tr');
  if(!headRow) return;
  const headers = [...headRow.children];
  const flagIndex = headers.findIndex(th => /^flag$/i.test((th.textContent || '').trim()));
  if(flagIndex > -1) {
    headRow.removeChild(headers[flagIndex]);
    table.querySelectorAll('tbody tr').forEach(tr => {
      const cells = tr.children;
      if(cells[flagIndex]) tr.removeChild(cells[flagIndex]);
    });
  }
}

export function setColumnClasses(table) {
  const headerCells = [...table.querySelector('thead tr').children];
  headerCells.forEach((th, i) => {
    const name = (th.textContent || '').trim().toLowerCase();
    if(name === 'category') th.classList.add('col-category');
    if(name === 'partner a') th.classList.add('col-a');
    if(name === 'match') th.classList.add('col-match');
    if(name === 'partner b') th.classList.add('col-b');
  });
  table.querySelectorAll('tbody tr').forEach(tr => {
    [...tr.children].forEach((td, i) => {
      const name = (headerCells[i].textContent || '').trim().toLowerCase();
      if(name === 'category') td.classList.add('col-category');
      if(name === 'partner a') td.classList.add('col-a');
      if(name === 'match') td.classList.add('col-match');
      if(name === 'partner b') td.classList.add('col-b');
    });
  });
}

export function preparePDFClone(){
  const src = document.getElementById('pdf-container');
  if(!src) throw new Error('#pdf-container not found');
  const clone = src.cloneNode(true);
  clone.classList.add('pdf-export');

  clone.querySelectorAll('table').forEach(table => {
    removeFlagColumn(table);
    setColumnClasses(table);
  });

  return clone;
}

// Integrate with your existing PDF generation
export async function generateCompatibilityPDF(){
  const jsPDFCtor = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
  const clone = preparePDFClone();

  document.body.appendChild(clone);
  // your html2canvas + jsPDF logic here
  document.body.removeChild(clone);
}
