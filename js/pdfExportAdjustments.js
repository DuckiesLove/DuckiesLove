/* PDF Export Adjustments — Remove Flag + Left-align Category */
(function(){
  if(document.querySelector('style[data-pdf-fix]')) return;
  const css = `
    .pdf-export .col-category {
      text-align: left !important;
      white-space: normal !important;
    }
    .pdf-export .col-a, 
    .pdf-export .col-match, 
    .pdf-export .col-b {
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

export function mergeCategoryColumn(table) {
  const headerCells = [...table.querySelector('thead tr').children];
  const categoryIndex = headerCells.findIndex(th => /^category$/i.test((th.textContent || '').trim()));
  if(categoryIndex > -1) {
    headerCells[categoryIndex].classList.add('col-category');
    table.querySelectorAll('tbody tr').forEach(tr => {
      const cells = [...tr.children];
      if(cells[categoryIndex]) {
        cells[categoryIndex].classList.add('col-category');
        cells[categoryIndex].style.whiteSpace = 'normal';
      }
    });
  }
}

export function preparePDFClone(){
  const src = document.getElementById('pdf-container');
  if(!src) throw new Error('#pdf-container not found');
  const clone = src.cloneNode(true);
  clone.classList.add('pdf-export');

  // Remove Flag column
  clone.querySelectorAll('table').forEach(removeFlagColumn);

  // Merge and left-align category column
  clone.querySelectorAll('table').forEach(mergeCategoryColumn);

  return clone;
}

// Integrate with your existing PDF generation
export async function generateCompatibilityPDF(){
  const jsPDFCtor = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
  const clone = preparePDFClone();

  document.body.appendChild(clone);
  // Your html2canvas + jsPDF export code here
  document.body.removeChild(clone);
}
