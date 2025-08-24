// FIX: html2canvas snapshot was exporting as a solid black page.
// Causes: (a) JPEG can’t store transparency → transparent areas become black,
//         (b) backgroundColor not set in html2canvas, (c) drawing order.
// Solution: force a real background color for the snapshot, export PNG (with alpha),
//           and NEVER paint a full-page rect in jsPDF before addImage.

function loadScript(src) {
  return new Promise((res, rej) => {
    if (document.querySelector(`script[src="${src}"]`)) return res();
    const s = document.createElement('script');
    s.src = src;
    s.onload = res;
    s.onerror = () => rej(new Error('Failed to load ' + src));
    document.head.appendChild(s);
  });
}

function getJsPDF() {
  return (window.jspdf && window.jspdf.jsPDF) || (window.jsPDF && window.jsPDF.jsPDF);
}

async function ensureLibs() {
  if (!window.html2canvas) {
    try { await loadScript('/lib/html2canvas.min.js'); }
    catch { await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'); }
  }
  if (!window.html2canvas) throw new Error('html2canvas failed to load.');

  if (!getJsPDF()) {
    try { await loadScript('/lib/jspdf.umd.min.js'); }
    catch { await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'); }
  }
  if (!getJsPDF()) throw new Error('jsPDF failed to load.');
}

function resolveSnapshotBgColor(el) {
  const cs = getComputedStyle(el || document.body);
  const varBg = getComputedStyle(document.body).getPropertyValue('--pdf-bg')?.trim();
  if (varBg && /^#([0-9a-f]{6})$/i.test(varBg)) return varBg;

  const bg = cs.backgroundColor || 'rgba(0,0,0,0)';
  if (/rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+(?:\s*,\s*0(?:\.0+)?)?\s*\)/i.test(bg)) {
    const m = bg.match(/rgba?\(([^)]+)\)/i);
    if (m) {
      const parts = m[1].split(',').map(x => x.trim());
      if (parts.length === 4 && parseFloat(parts[3]) === 0) return '#ffffff';
    }
  }
  if (!bg || bg === 'transparent') return '#ffffff';
  return bg;
}

export async function downloadCompatibilityPDFCanvas({
  selector = '#compatibilityTable',
  filename = 'compatibility-report.pdf',
  orientation = 'landscape',
  pageFormat = 'a4',
  scale = Math.max(2, Math.floor(window.devicePixelRatio || 2)),
  padding = 0
} = {}) {
  await ensureLibs();

  const root = document.querySelector(selector) ||
               document.querySelector('table.results-table.compat') ||
               document.querySelector('.results-table.compat') ||
               document.body;

  if (!root) { alert('Export target not found.'); return; }

  await new Promise(r => requestAnimationFrame(r));

  const snapshotBg = resolveSnapshotBgColor(root);

  const selectorEsc = CSS.escape(selector.replace(/^#/, '#'));
  const canvas = await window.html2canvas(root, {
    backgroundColor: snapshotBg,
    useCORS: true,
    allowTaint: false,
    imageTimeout: 0,
    scale,
    windowWidth: document.documentElement.scrollWidth,
    windowHeight: document.documentElement.scrollHeight,
    foreignObjectRendering: true,
    onclone(clonedDoc) {
      if (!padding) return;
      const clonedRoot = clonedDoc.querySelector(selector) ||
                         clonedDoc.querySelector('table.results-table.compat') ||
                         clonedDoc.querySelector('.results-table.compat') ||
                         clonedDoc.body;
      if (clonedRoot) {
        const st = clonedDoc.createElement('style');
        st.textContent = `
          ${selectorEsc}, table.results-table.compat, .results-table.compat {
            box-sizing: border-box !important;
            padding: ${padding}px !important;
            background-color: ${snapshotBg} !important;
          }
        `;
        clonedDoc.head.appendChild(st);
      }
    }
  });

  const imgData = canvas.toDataURL('image/png');

  const jsPDF = getJsPDF();
  const doc = new jsPDF({ orientation, unit: 'pt', format: pageFormat });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  const imgW = canvas.width;
  const imgH = canvas.height;
  const pageRatio = pageW / pageH;
  const imgRatio  = imgW / imgH;

  let renderW, renderH;
  if (imgRatio > pageRatio) {
    renderW = pageW;
    renderH = pageW / imgRatio;
  } else {
    renderH = pageH;
    renderW = pageH * imgRatio;
  }
  const x = (pageW - renderW) / 2;
  const y = (pageH - renderH) / 2;

  doc.addImage(imgData, 'PNG', x, y, renderW, renderH);
  doc.save(filename);
}

// Optional helper to bind the default download button
export function bindCanvasPdfButton() {
  const btn = document.querySelector('#downloadBtn') ||
              document.querySelector('#downloadPdfBtn') ||
              document.querySelector('[data-download-pdf]');
  if (!btn) return;
  btn.addEventListener('click', () => downloadCompatibilityPDFCanvas());
}


