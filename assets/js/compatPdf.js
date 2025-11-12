/* assets/js/compatPdf.js
 * Wrapper that loads the shared pdfDownload.js module and feeds it the
 * surveys stored by assets/js/comparison.js. The old AutoTable exporter
 * duplicated a ton of logic and never saw the same fixes as the primary
 * module, which is why the generated PDFs looked broken. This bridge keeps
 * the legacy button binding (clone + single handler) but delegates all heavy
 * lifting to downloadCompatibilityPDF so both pages share the same renderer.
 */
(() => {
  if (window.__TK_ASSET_COMPAT_PDF__) return;
  window.__TK_ASSET_COMPAT_PDF__ = true;

  const DEFAULT_FILENAME = 'talkkink-compatibility-results.pdf';
  const SELF_KEYS = ['tk_compat.self', 'talkkink:mine', 'talkkink:survey', 'tk_compat.mine'];
  const PARTNER_KEYS = ['tk_compat.partner', 'talkkink:partner'];

  const scriptDir = (() => {
    try {
      const current = document.currentScript;
      if (current && current.src) return new URL('./', current.src);
    } catch (_) {
      /* ignore */
    }
    return new URL('./', window.location.href);
  })();

  const moduleUrl = new URL('../../js/pdfDownload.js', scriptDir).href;

  const safeParse = (raw) => {
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (error) {
      console.warn('[compat-pdf] unable to parse stored payload', error);
      return null;
    }
  };

  const readStoredKeys = (keys) => {
    if (!Array.isArray(keys)) return null;
    for (const key of keys) {
      try {
        const value = safeParse(localStorage.getItem(key));
        if (value) return value;
      } catch (error) {
        console.warn('[compat-pdf] unable to read storage key', key, error);
      }
    }
    return null;
  };

  function pickSources(opts = {}) {
    const mine =
      opts.mine ??
      window.talkkinkMine ??
      window.talkkinkSurvey ??
      readStoredKeys(SELF_KEYS);

    const partner =
      opts.partner ??
      window.talkkinkPartner ??
      readStoredKeys(PARTNER_KEYS);

    return { mine, partner };
  }

  const cleanSegment = (value) => {
    if (!value) return '';
    const text = String(value).trim();
    if (!text) return '';
    return text.replace(/[^\w.-]+/g, '-').replace(/-{2,}/g, '-').replace(/^-+|-+$/g, '').slice(0, 48);
  };

  const surveyLabel = (survey) => {
    if (!survey || typeof survey !== 'object') return '';
    const meta = survey.meta && typeof survey.meta === 'object' ? survey.meta : {};
    return (
      cleanSegment(meta.surveyTitle) ||
      cleanSegment(meta.title) ||
      cleanSegment(meta.name) ||
      cleanSegment(survey.name || survey.title || survey.owner)
    );
  };

  function deriveFilename(mine, partner, override) {
    if (override) return override;
    const a = surveyLabel(mine);
    const b = surveyLabel(partner);
    if (a && b) return `${a}-vs-${b}-compatibility.pdf`;
    if (a || b) return `${a || b}-compatibility.pdf`;
    return DEFAULT_FILENAME;
  }

  let downloaderPromise = null;
  async function loadDownloader() {
    if (typeof window.downloadCompatibilityPDF === 'function') {
      return window.downloadCompatibilityPDF;
    }
    if (!downloaderPromise) {
      window.__TK_PDF_SKIP_AUTO_BIND__ = true;
      downloaderPromise = import(moduleUrl)
        .then((mod) => {
          const fn = mod?.downloadCompatibilityPDF || mod?.default || window.downloadCompatibilityPDF;
          if (typeof fn !== 'function') {
            throw new Error('downloadCompatibilityPDF is unavailable after loading pdfDownload.js');
          }
          return fn;
        })
        .catch((error) => {
          console.error('[compat-pdf] Failed to load pdfDownload.js', error);
          throw error;
        });
    }
    return downloaderPromise;
  }

  let activeDownload = null;
  const allowSinglePartner = () =>
    Boolean(window.__TK_ALLOW_SINGLE_PDF__ || document.body?.dataset?.allowSinglePdf === 'true');

  async function runDownload(opts = {}) {
    if (activeDownload) return activeDownload;

    const { mine, partner } = pickSources(opts);
    if (!mine && !partner) {
      alert('Upload at least one survey before downloading the compatibility PDF.');
      return null;
    }

    if (!allowSinglePartner() && !(mine && partner)) {
      alert('Upload both surveys before downloading the compatibility PDF.');
      return null;
    }

    const filename = deriveFilename(mine, partner, opts.filename);

    activeDownload = (async () => {
      try {
        const download = await loadDownloader();
        await download(mine, partner, { filename });
      } catch (error) {
        console.error('[compat-pdf] Failed to generate compatibility PDF', error);
        alert('Could not generate the compatibility PDF. Check the console for details.');
      } finally {
        activeDownload = null;
      }
    })();

    return activeDownload;
  }

  window.TKPDF = {
    download: (opts = {}) => runDownload(opts),
    generateFromStorage: () => runDownload(),
  };

  function rebindDownloadButton() {
    if (window.__TKPDF_BOUND__) return;
    window.__TKPDF_BOUND__ = true;

    const findBtn = () =>
      document.querySelector('#downloadPdfBtn, #btnDownloadPdf, #downloadBtn') ||
      [...document.querySelectorAll('button, a')].find((el) => /download pdf/i.test(el.textContent || ''));

    const btn = findBtn();
    if (!btn) {
      console.warn('[compat-pdf] download button not found');
      return;
    }

    const clone = btn.cloneNode(true);
    btn.replaceWith(clone);

    clone.addEventListener(
      'click',
      (event) => {
        event.preventDefault?.();
        event.stopPropagation?.();
        runDownload();
      },
      { passive: true }
    );
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', rebindDownloadButton, { once: true });
  } else {
    rebindDownloadButton();
  }
})();
