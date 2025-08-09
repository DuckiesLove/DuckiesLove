const PDF_DEBUG_SHOW_CLONE = false;

function ensureHtml2Pdf() {
  if (
    typeof window !== 'undefined' &&
    !window.html2pdf &&
    typeof document !== 'undefined' &&
    document.head
  ) {
    const s = document.createElement('script');
    s.src = 'https://unpkg.com/html2pdf.js@0.9.3/dist/html2pdf.bundle.min.js';
    s.defer = true;
    document.head.appendChild(s);
  }
}
ensureHtml2Pdf();

function injectPdfCSS() {
  if (
    typeof document === 'undefined' ||
    !document.head ||
    document.querySelector('style[data-pdf-style]')
  )
    return;
  const css = `
  .pdf-export{background:#000!important;color:#fff!important;padding:24px!important;margin:0!important}
  .pdf-export table{width:100%!important;border-collapse:collapse!important;table-layout:fixed!important;background:transparent!important;color:#fff!important}
  .pdf-export th,.pdf-export td{border:none!important;background:transparent!important;color:#fff!important;padding:6px 8px!important;line-height:1.25!important;vertical-align:top!important;word-break:break-word!important;white-space:normal!important;box-sizing:border-box!important;page-break-inside:avoid!important;break-inside:avoid!important}
  .pdf-export tr{page-break-inside:avoid!important;break-inside:avoid!important}
  .section-title,.category-header,.compat-category{border:none!important;box-shadow:none!important;background:transparent!important;padding:6px 0!important}
  .category-emoji,.category-header .emoji,.section-title .emoji{display:none!important}
  `;
  const style = document.createElement('style');
  style.setAttribute('data-pdf-style', 'true');
  style.textContent = css;
  document.head.appendChild(style);
}
injectPdfCSS();

function stripHeaderEmoji(root = document) {
  const re = /[\p{Extended_Pictographic}\p{Emoji_Presentation}]/gu;
  root
    .querySelectorAll('.section-title,.category-header,.compat-category,th')
    .forEach(n => {
      const text = (n.textContent || '').replace(re, '').trim();
      if (text) n.textContent = text;
    });
}

async function waitUntilRenderReady(container) {
  if (document.fonts && document.fonts.ready) {
    try {
      await document.fonts.ready;
    } catch (_) {}
  }
  const t0 = Date.now();
  while (true) {
    const hasRows = Array.from(
      container.querySelectorAll('table tbody')
    ).some(tb => tb.children && tb.children.length > 0);
    if (hasRows) break;
    if (Date.now() - t0 > 6000) {
      console.warn('[pdf] timeout waiting for table rows');
      break;
    }
    await new Promise(r => setTimeout(r, 100));
  }
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
}

function forceTableDisplay(root) {
  root.querySelectorAll('table').forEach(el => (el.style.display = 'table'));
  root
    .querySelectorAll('thead')
    .forEach(el => (el.style.display = 'table-header-group'));
  root
    .querySelectorAll('tbody')
    .forEach(el => (el.style.display = 'table-row-group'));
  root.querySelectorAll('tr').forEach(el => (el.style.display = 'table-row'));
  root
    .querySelectorAll('td,th')
    .forEach(el => (el.style.display = 'table-cell'));
}

function makePdfClone() {
  const src = document.getElementById('pdf-container');
  if (!src) throw new Error('#pdf-container not found');

  const shell = document.createElement('div');
  Object.assign(shell.style, {
    background: '#000',
    color: '#fff',
    margin: '0',
    padding: '0',
    width: '100%',
    minHeight: '100vh',
    overflow: 'auto',
  });

  const clone = src.cloneNode(true);
  clone.classList.add('pdf-export');

  clone
    .querySelectorAll('[data-hide-in-pdf], .download-btn, .print-btn, nav, header, footer')
    .forEach(el => el.remove());

  stripHeaderEmoji(clone);

  shell.appendChild(clone);
  document.body.appendChild(shell);

  if (PDF_DEBUG_SHOW_CLONE) {
    Object.assign(shell.style, {
      position: 'fixed',
      inset: '0',
      zIndex: '999999',
    });
    const banner = document.createElement('div');
    banner.textContent = 'PDF CLONE PREVIEW — press ESC to close';
    Object.assign(banner.style, {
      position: 'sticky',
      top: '0',
      padding: '8px 12px',
      background: '#111',
      color: '#fff',
      fontSize: '12px',
      zIndex: '1000000',
    });
    shell.prepend(banner);
    window.addEventListener('keydown', e => {
      if (e.key === 'Escape') shell.remove();
    });
  }

  return { shell, clone };
}

function computeCaptureWidth(el) {
  const r = el.getBoundingClientRect();
  return Math.ceil(Math.max(el.scrollWidth, r.width, document.documentElement.clientWidth));
}

export async function downloadCompatibilityPDF() {
  try {
    const src = document.getElementById('pdf-container');
    if (!src) {
      alert('PDF container not found');
      return;
    }

    stripHeaderEmoji(document);
    await waitUntilRenderReady(src);

    const { shell, clone } = makePdfClone();

    forceTableDisplay(clone);

    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

    clone.querySelectorAll('table').forEach(t => {
      t.style.width = '100%';
      t.style.tableLayout = 'fixed';
      t.style.borderCollapse = 'collapse';
      t.style.pageBreakInside = 'avoid';
      t.style.breakInside = 'avoid';
    });
    clone.querySelectorAll('tr').forEach(tr => {
      tr.style.pageBreakInside = 'avoid';
      tr.style.breakInside = 'avoid';
    });

    const captureWidth = computeCaptureWidth(clone);

    const prevHtmlMargin = document.documentElement.style.margin;
    const prevBodyMargin = document.body.style.margin;
    document.documentElement.style.margin = '0';
    document.body.style.margin = '0';

    if (!window.html2pdf) {
      await new Promise((res, rej) => {
        let t = 0;
        const h = setInterval(() => {
          if (window.html2pdf) {
            clearInterval(h);
            res();
          } else if ((t += 100) > 8000) {
            clearInterval(h);
            rej(new Error('html2pdf not loaded'));
          }
        }, 100);
      });
    }

    const opt = {
      margin: 0,
      filename: 'kink-compatibility.pdf',
      image: { type: 'jpeg', quality: 1 },
      html2canvas: {
        backgroundColor: '#000',
        scale: 2,
        useCORS: true,
        scrollX: 0,
        scrollY: 0,
        windowWidth: captureWidth,
      },
      jsPDF: { unit: 'pt', format: 'letter', orientation: 'portrait' },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'], before: '.compat-section' },
    };

    if (!PDF_DEBUG_SHOW_CLONE) {
      await html2pdf().set(opt).from(shell).save();
      document.documentElement.style.margin = prevHtmlMargin;
      document.body.style.margin = prevBodyMargin;
      document.body.removeChild(shell);
    } else {
      console.log('[pdf] Debug ON — showing clone only. Set PDF_DEBUG_SHOW_CLONE=false to export.');
    }
  } catch (err) {
    console.error('[pdf] generation failed:', err);
    alert('Could not generate PDF. See console for details.');
  }
}

export const exportToPDF = downloadCompatibilityPDF;
export const exportCompatPDF = downloadCompatibilityPDF;
export const exportKinkCompatibilityPDF = downloadCompatibilityPDF;
export const generateCompatibilityPDF = downloadCompatibilityPDF;

function wireBtn() {
  const btn =
    document.getElementById('downloadBtn') ||
    document.querySelector('[data-download-pdf]');
  if (!btn) {
    console.warn(
      '[pdf] No download button found. Add id="downloadBtn" or data-download-pdf.'
    );
    return;
  }
  const fresh = typeof btn.cloneNode === 'function' ? btn.cloneNode(true) : btn;
  if (fresh !== btn && btn.parentNode) {
    btn.parentNode.replaceChild(fresh, btn);
  }
  fresh.addEventListener('click', downloadCompatibilityPDF);
}

if (typeof window !== 'undefined') {
  window.downloadCompatibilityPDF = downloadCompatibilityPDF;
  window.addEventListener('DOMContentLoaded', wireBtn);
}
