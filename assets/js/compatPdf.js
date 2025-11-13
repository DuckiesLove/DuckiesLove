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

  const JSPDF_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
  const scriptLoadCache = new Map();

  const getJsPDFCtor = () =>
    window.jspdf?.jsPDF ||
    window.jsPDF?.jsPDF ||
    window.jsPDF ||
    null;

  const waitForScript = (script) => new Promise((resolve, reject) => {
    if (!script) {
      resolve();
      return;
    }

    const state = script.readyState;
    if (state === 'loaded' || state === 'complete') {
      resolve();
      return;
    }

    const cleanup = () => {
      script.removeEventListener('load', onLoad);
      script.removeEventListener('error', onError);
    };

    function onLoad() {
      cleanup();
      resolve();
    }

    function onError(event) {
      cleanup();
      const reason = event?.message ? new Error(event.message) : new Error('Failed to load script');
      reject(reason);
    }

    script.addEventListener('load', onLoad, { once: true });
    script.addEventListener('error', onError, { once: true });
  });

  const loadScript = (src) => {
    if (!src) return Promise.reject(new Error('Script src missing'));

    if (scriptLoadCache.has(src)) {
      return scriptLoadCache.get(src);
    }

    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      const promise = waitForScript(existing);
      scriptLoadCache.set(src, promise);
      return promise;
    }

    const promise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.defer = true;
      script.addEventListener('load', () => resolve(), { once: true });
      script.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), { once: true });
      document.head.appendChild(script);
    });

    scriptLoadCache.set(src, promise);
    return promise;
  };

  async function ensureJsPDF() {
    const ctor = getJsPDFCtor();
    if (ctor) return ctor;

    if (typeof window.tkLoadPdfLibs === 'function') {
      try {
        await window.tkLoadPdfLibs();
      } catch (error) {
        console.warn('[compat-pdf] tkLoadPdfLibs failed to load jsPDF', error);
      }
    }

    let loadedCtor = getJsPDFCtor();
    if (loadedCtor) return loadedCtor;

    const taggedScript = document.querySelector('script[data-lib="jspdf"]');
    if (taggedScript) {
      try {
        await waitForScript(taggedScript);
      } catch (error) {
        console.warn('[compat-pdf] Failed waiting for existing jsPDF script', error);
      }
    }

    loadedCtor = getJsPDFCtor();
    if (loadedCtor) return loadedCtor;

    await loadScript(JSPDF_CDN);

    loadedCtor = getJsPDFCtor();
    if (!loadedCtor) {
      throw new Error('jsPDF not available');
    }

    return loadedCtor;
  }

  const handlePdfError = (err) => {
    console.error('[compat-pdf] Failed to generate compatibility PDF', err);
    alert('Could not generate the compatibility PDF. Check the console for details.');
  };

  window.TKPDF = {
    download: async (opts = {}) => {
      try {
        await ensureJsPDF();
        return await runGenerator(opts);
      } catch (err) {
        handlePdfError(err);
        return null;
      }
    },
    generateFromStorage: async () => {
      try {
        await ensureJsPDF();
        return await runGenerator();
      } catch (err) {
        handlePdfError(err);
        return null;
      }
    },
  };

  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.querySelector('#downloadPdfBtn, #downloadBtn, [data-download-pdf]');
    if (!btn) {
      console.error('[compat-pdf] Download button not found');
      return;
    }

    const restoreState = !btn.disabled;
    btn.disabled = true;

    ensureJsPDF()
      .then(() => {
        if (restoreState) btn.disabled = false;
      })
      .catch((err) => {
        console.error('[compat-pdf] jsPDF not available', err);
        btn.title = 'PDF temporarily unavailable';
      });

    btn.addEventListener('click', async () => {
      try {
        await ensureJsPDF();
        await runGenerator();
      } catch (err) {
        handlePdfError(err);
      }
    });
  });
})();
