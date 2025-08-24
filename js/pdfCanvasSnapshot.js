// Canvas-based compatibility PDF export without black overlay
// Loads html2canvas and jsPDF only when needed.

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error('Failed to load ' + src));
    document.head.appendChild(s);
  });
}

function getJsPDF() {
  return (window.jspdf && window.jspdf.jsPDF) ||
         (window.jsPDF && window.jsPDF.jsPDF);
}

async function loadJsPDF() {
  if (!getJsPDF()) {
    try { await loadScript('/lib/jspdf.umd.min.js'); }
    catch { await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'); }
  }
}

async function ensureLibs() {
  if (!window.html2canvas) {
    try { await loadScript('/lib/html2canvas.min.js'); }
    catch { await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'); }
  }
  if (!window.html2canvas) {
    throw new Error('html2canvas failed to load. PDF export unavailable.');
  }
  await loadJsPDF();
  if (!getJsPDF()) throw new Error('jsPDF missing');
}

export async function downloadCompatibilityPDFCanvas({
  selector = '#compatibilityTable',
  filename = 'compatibility-report.pdf',
  landscape = true,
  padding = 16,
  scale = 2
} = {}) {
  await ensureLibs();

  const root =
    document.querySelector(selector) ||
    document.querySelector('.results-table.compat') ||
    document.body;

  if (!root) {
    alert('Export target not found.');
    return;
  }

  await new Promise(r => requestAnimationFrame(r));

  const canvas = await window.html2canvas(root, {
    background: null,
    useCORS: true,
    allowTaint: false,
    scale,
    windowWidth: document.documentElement.scrollWidth,
    windowHeight: document.documentElement.scrollHeight,
    onclone(clonedDoc) {
      const clonedRoot = clonedDoc.querySelector(selector) ||
                         clonedDoc.querySelector('.results-table.compat') ||
                         clonedDoc.body;
      if (clonedRoot && padding) {
        const style = clonedDoc.createElement('style');
        style.textContent = `
          ${selector}, .results-table.compat {
            box-sizing: border-box !important;
            padding: ${padding}px !important;
          }
        `;
        clonedDoc.head.appendChild(style);
      }
    }
  });

  const imgData = canvas.toDataURL('image/jpeg', 0.95);

  const jsPDF = getJsPDF();
  const doc = new jsPDF({
    orientation: landscape ? 'landscape' : 'portrait',
    unit: 'pt',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const imgWidth = canvas.width;
  const imgHeight = canvas.height;
  const pageRatio = pageWidth / pageHeight;
  const imgRatio = imgWidth / imgHeight;

  let renderWidth, renderHeight;
  if (imgRatio > pageRatio) {
    renderWidth = pageWidth;
    renderHeight = pageWidth / imgRatio;
  } else {
    renderHeight = pageHeight;
    renderWidth = pageHeight * imgRatio;
  }

  const x = (pageWidth - renderWidth) / 2;
  const y = (pageHeight - renderHeight) / 2;

  doc.addImage(imgData, 'JPEG', x, y, renderWidth, renderHeight);
  doc.save(filename);
}

(function bindDownload() {
  const btn = document.querySelector('#downloadBtn') ||
              document.querySelector('#downloadPdfBtn') ||
              document.querySelector('[data-download-pdf]');
  if (!btn) return;
  btn.addEventListener('click', () => downloadCompatibilityPDFCanvas());
})();

