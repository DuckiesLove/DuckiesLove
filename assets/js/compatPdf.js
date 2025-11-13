(() => {
  if (window.__TK_ASSET_COMPAT_PDF__) return;
  window.__TK_ASSET_COMPAT_PDF__ = true;

  const scriptDir = (() => {
    try {
      const current = document.currentScript;
      if (current && current.src) return new URL('./', current.src);
    } catch (_) {
      /* ignore */
    }
    return new URL('./', window.location.href);
  })();

  const moduleUrl = new URL('../../js/compatibilityPdf.js', scriptDir).href;

  let generatorPromise = null;
  async function loadGenerator() {
    if (!generatorPromise) {
      generatorPromise = import(moduleUrl)
        .then((mod) => {
          const fn = mod?.generateCompatibilityPDF || mod?.default;
          if (typeof fn !== 'function') {
            throw new Error('generateCompatibilityPDF is unavailable after loading compatibilityPdf.js');
          }
          return fn;
        })
        .catch((error) => {
          console.error('[compat-pdf] Failed to load compatibilityPdf.js', error);
          throw error;
        });
    }
    return generatorPromise;
  }

  async function runGenerator(opts = {}) {
    const generate = await loadGenerator();
    return generate(undefined, opts);
  }

  const handlePdfError = (err) => {
    console.error('[compat-pdf] Failed to generate compatibility PDF', err);
    alert('Could not generate the compatibility PDF. Check the console for details.');
  };

  window.TKPDF = {
    download: async (opts = {}) => {
      try {
        return await runGenerator(opts);
      } catch (err) {
        handlePdfError(err);
        return null;
      }
    },
    generateFromStorage: async () => {
      try {
        return await runGenerator();
      } catch (err) {
        handlePdfError(err);
        return null;
      }
    },
  };

  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('downloadBtn');
    if (!btn) {
      console.error('[compat-pdf] Download button not found');
      return;
    }

    btn.addEventListener('click', async () => {
      try {
        await runGenerator();
      } catch (err) {
        handlePdfError(err);
      }
    });
  });
})();
