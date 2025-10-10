;(function () {
  /* global TK */

  // Dynamically load jsPDF + html2canvas when needed
  async function ensureVendors() {
    if (!window.jspdf) {
      await new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = '/js/vendor/jspdf.umd.min.js';
        s.onload = res; s.onerror = rej; document.head.appendChild(s);
      });
    }
    if (!window.html2canvas) {
      await new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = '/js/vendor/html2canvas.min.js';
        s.onload = res; s.onerror = rej; document.head.appendChild(s);
      });
    }
  }

  // Replace any code IDs in the *current DOM* before snapshot
  async function relabelNow() {
    const codeRe = /^cb_[a-z0-9]+$/i;
    const { labelsMap } = await TK.loadKinkData();
    const map = labelsMap || {};
    document.querySelectorAll('table td, table th').forEach(td => {
      const t = (td.textContent || '').trim();
      if (codeRe.test(t) && map[t]) td.textContent = map[t];
    });
  }

  async function makeFullBleedPDF() {
    await ensureVendors();
    await relabelNow();

    const { jsPDF } = window.jspdf;
    const root = document.querySelector('.wrap') || document.body;

    // Snapshot with black background and decent scale
    const canvas = await html2canvas(root, {
      backgroundColor: '#000',
      scale: Math.min(2.5, window.devicePixelRatio || 2),
      useCORS: true,
      logging: false,
      windowWidth: document.documentElement.scrollWidth,
      windowHeight: document.documentElement.scrollHeight
    });

    const imgData = canvas.toDataURL('image/png');
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();

    // Fill black background to ensure true full-bleed look
    doc.setFillColor(0,0,0);
    doc.rect(0,0,pageW,pageH,'F');

    // Cover-fit the canvas image to the PDF page
    const imgW = canvas.width;
    const imgH = canvas.height;
    const scale = Math.max(pageW / imgW, pageH / imgH);
    const drawW = imgW * scale;
    const drawH = imgH * scale;
    const offX  = (pageW - drawW) / 2;
    const offY  = (pageH - drawH) / 2;

    doc.addImage(imgData, 'PNG', offX, offY, drawW, drawH, undefined, 'FAST');
    doc.save('compatibility.pdf');
  }

  function hijackDownloadButton() {
    const targets = [
      document.querySelector('#dl'),
      document.querySelector('[data-action="download-pdf"]')
    ].filter(Boolean);

    targets.forEach(btn => {
      // Intercept any existing window.print() or href clicks
      btn.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        makeFullBleedPDF().catch(err => {
          console.error('[TK-PDF] Failed, falling back to window.print():', err);
          window.print();
        });
      }, { capture: true });
    });
  }

  document.addEventListener('DOMContentLoaded', hijackDownloadButton);
})();
