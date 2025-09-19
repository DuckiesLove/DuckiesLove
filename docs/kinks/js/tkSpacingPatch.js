/*
  Talk Kink — page-1 spacing fix (PDF clone only)
  What this does:
  • Centers “Talk Kink”, pushes it slightly DOWN on page 1 (PDF only)
  • Pulls the first section/table UP so there isn’t a huge gap
  • Does not touch the live web layout; only the hidden clone we render to PDF

  How to use:
  1) Include this script AFTER your PDF code (e.g., after pdfDownload.js import).
  2) Click "Download PDF" again and check the first page.
  3) If you want more/less movement, adjust TK_TITLE_DOWN_PT and TK_SECTION_UP_PT.
*/
(function attachTalkKinkSpacingPatch(){
  // --- knobs you can tweak ---
  const TK_TITLE_TEXT      = 'talk kink'; // case-insensitive match
  const TK_TITLE_DOWN_PT   = 24;          // move title DOWN by this many points
  const TK_SECTION_UP_PT   = 28;          // pull first section/table UP by this many points

  // Try to find the first heading inside the clone that looks like “Talk Kink”
  function findTitleEl(root){
    // Strong candidates first
    let el =
      root.querySelector('.tk-pdf-title') ||
      root.querySelector('[data-pdf-title]') ||
      root.querySelector('h1.site-title, .site-title, header h1, h1');

    // If we didn't find a clear title element, try any heading that matches text
    if (!el) {
      const headings = root.querySelectorAll('h1,h2,.brand,.logo,.title');
      for (const h of headings) {
        if ((h.textContent || '').trim().toLowerCase().includes(TK_TITLE_TEXT)) {
          el = h; break;
        }
      }
    }
    return el || null;
  }

  // Find the very first section/table block under the title to pull upward
  function findFirstContentBlock(root, titleEl){
    // Look for common wrappers used in your build
    const candidates = [
      '.compat-section',
      '.categories-table',
      '.section-title',
      'table',
      'h2.section-title',
      'h2'
    ];
    for (const sel of candidates) {
      const node = root.querySelector(sel);
      if (node && (!titleEl || node.compareDocumentPosition(titleEl) & Node.DOCUMENT_POSITION_FOLLOWING)) {
        return node;
      }
    }
    return null;
  }

  // Apply inline styles (strongest in the clone) — affects PDF only
  function adjustClone(clone){
    try {
      // 1) Title
      const title = findTitleEl(clone);
      if (title) {
        title.style.textAlign   = 'center';
        title.style.fontWeight  = '900';
        title.style.fontSize    = '56pt';     // looks nice in letter landscape
        title.style.lineHeight  = '1.05';
        title.style.marginTop   = (TK_TITLE_DOWN_PT) + 'pt';   // push DOWN
        title.style.marginBottom= '0';
        title.style.padding     = '0';
      }

      // 2) First content block after title: pull UP
      const first = findFirstContentBlock(clone, title);
      if (first) {
        // Negative margin to pull up toward the title
        const current = parseFloat(getComputedStyle(first).marginTop || '0') || 0;
        first.style.marginTop = (current - TK_SECTION_UP_PT) + 'pt';
      }

      // 3) If the “web logo” appears under the upload buttons and got copied into the clone,
      //    hide it so it doesn’t show up again near the title in the PDF.
      const strayLogos = clone.querySelectorAll('.web-logo, .footer-logo, .hero-logo');
      strayLogos.forEach(n => n.style.display = 'none');
    } catch (e) {
      console.warn('[tk-spacing] adjustClone failed:', e);
    }
  }

  // Monkey-patch downloadCompatibilityPDF to adjust the clone before render.
  // Works with both exported function and window-assigned one.
  function wrapDownloader(){
    const ref = window.downloadCompatibilityPDF;
    if (typeof ref !== 'function') {
      console.warn('[tk-spacing] downloadCompatibilityPDF not found yet; retrying…');
      setTimeout(wrapDownloader, 300);
      return;
    }

    // Only wrap once
    if (ref.__tkWrapped) return;

    window.downloadCompatibilityPDF = async function wrappedDownload(){
      // We don’t know your internal makeClone(), so hook the DOM after the clone appears.
      // Strategy: snapshot body kids, call the original, and if we detect a temporary
      // full-screen overlay clone (common pattern), adjust it before render runs.
      const before = new Set(Array.from(document.body.children));

      // Call original; it will build the clone synchronously, then render
      // (it’s fine if it’s async — we’ll let it continue)
      const p = ref.apply(this, arguments);

      // Find a newly inserted full-window DIV that looks like the PDF shell
      requestAnimationFrame(()=>{
        const after = Array.from(document.body.children).filter(n => !before.has(n));
        const shell = after.find(n => n.nodeType === 1 && n.matches('div')) || null;
        const clone = shell ? shell.querySelector('.pdf-export') : null;
        if (clone) adjustClone(clone);
      });

      return p;
    };

    window.downloadCompatibilityPDF.__tkWrapped = true;
    console.log('[tk-spacing] PDF downloader wrapped: title down / first section up will apply in PDF.');
  }

  // Start the wrapping once scripts are ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wrapDownloader);
  } else {
    wrapDownloader();
  }
})();
