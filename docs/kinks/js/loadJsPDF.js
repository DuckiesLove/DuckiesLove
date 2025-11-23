let cachedJsPDF = null;
let pendingLoad = null;
let autoTablePending = null;
let autoTableReady = false;

const CDN_SOURCES = [
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js',
  'https://unpkg.com/jspdf@2.5.1/dist/jspdf.umd.min.js',
];

const AUTOTABLE_CDN_SOURCES = [
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.3/jspdf.plugin.autotable.min.js',
  'https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.3/dist/jspdf.plugin.autotable.min.js',
  'https://unpkg.com/jspdf-autotable@3.8.3/dist/jspdf.plugin.autotable.min.js',
];

const LOCAL_SOURCES = (() => {
  const urls = [];
  try {
    const bundled = new URL('./vendor/jspdf.umd.min.js', import.meta.url);
    urls.push(bundled.href);
  } catch (_) {
    // Ignore environments that lack import.meta
  }
  urls.push('/js/vendor/jspdf.umd.min.js');
  return urls;
})();

const AUTOTABLE_LOCAL_SOURCES = (() => {
  const urls = [];
  try {
    const bundled = new URL('./vendor/jspdf.plugin.autotable.min.js', import.meta.url);
    urls.push(bundled.href);
  } catch (_) {
    // Ignore environments that lack import.meta
  }
  urls.push('/js/vendor/jspdf.plugin.autotable.min.js');
  return urls;
})();

function getGlobalCandidates() {
  const ordered = [];
  if (typeof globalThis !== 'undefined' && globalThis.window) {
    ordered.push(globalThis.window);
  }
  if (typeof window !== 'undefined') {
    ordered.push(window);
  }
  if (typeof globalThis !== 'undefined') {
    ordered.push(globalThis);
  }
  const seen = new Set();
  return ordered.filter((candidate) => {
    if (!candidate || seen.has(candidate)) return false;
    seen.add(candidate);
    return true;
  });
}

function getDocument() {
  if (typeof document !== 'undefined' && document) return document;
  if (typeof window !== 'undefined' && window && window.document) return window.document;
  if (typeof globalThis !== 'undefined' && globalThis.document) return globalThis.document;
  return null;
}

function extractCtor(target) {
  if (!target) return null;
  if (target.jspdf && typeof target.jspdf.jsPDF === 'function') {
    return target.jspdf.jsPDF;
  }
  if (target.jsPDF && typeof target.jsPDF.jsPDF === 'function') {
    return target.jsPDF.jsPDF;
  }
  if (typeof target.jsPDF === 'function') {
    return target.jsPDF;
  }
  return null;
}

function assignAliases(scope, ctor) {
  if (!ctor) return;
  const targets = new Set([...getGlobalCandidates(), scope]);
  for (const target of targets) {
    if (!target || typeof target !== 'object') continue;
    if (target.jspdf && typeof target.jspdf.jsPDF === 'function' && typeof target.jsPDF !== 'function') {
      target.jsPDF = target.jspdf.jsPDF;
    }
    if (typeof target.jsPDF !== 'function') {
      target.jsPDF = ctor;
    }
    if (!target.jspdf) {
      target.jspdf = { jsPDF: ctor };
    } else if (typeof target.jspdf === 'object' && !target.jspdf.jsPDF) {
      target.jspdf.jsPDF = ctor;
    }
  }
  if (typeof globalThis.window === 'undefined' || globalThis.window == null) {
    globalThis.window = scope || globalThis;
  }
  if (typeof globalThis.jsPDF !== 'function') {
    globalThis.jsPDF = ctor;
  }
  if (!globalThis.jspdf || typeof globalThis.jspdf !== 'object') {
    globalThis.jspdf = { jsPDF: ctor };
  } else if (!globalThis.jspdf.jsPDF) {
    globalThis.jspdf.jsPDF = ctor;
  }
}

function getAutoTableApi() {
  for (const candidate of getGlobalCandidates()) {
    const api =
      candidate?.jspdf?.jsPDF?.API ||
      candidate?.jsPDF?.API ||
      candidate?.jsPDF?.jsPDF?.API;
    const fn = api?.autoTable || api?.__autoTable__;
    if (fn) return { api, fn };

    const legacy = candidate?.jspdf?.autoTable;
    if (legacy) {
      return { api: candidate?.jspdf?.jsPDF?.API || candidate?.jsPDF?.API || api || {}, fn: legacy };
    }
  }
  return { api: null, fn: null };
}

function findExistingJsPDF() {
  for (const candidate of getGlobalCandidates()) {
    const ctor = extractCtor(candidate);
    if (ctor) {
      return { ctor, scope: candidate };
    }
  }
  return { ctor: null, scope: null };
}

function getScriptByKey(doc, key) {
  if (!doc || typeof doc.querySelector !== 'function') return null;
  if (!key) return null;
  try {
    return doc.querySelector(`script[data-lib="${key}"]`);
  } catch (_) {
    return null;
  }
}

function injectScript(src, key) {
  const doc = getDocument();
  if (!doc || typeof doc.createElement !== 'function' || !doc.head) {
    throw new Error('No document available for jsPDF injection');
  }

  const existing = getScriptByKey(doc, key) || (doc.querySelector ? doc.querySelector(`script[src="${src}"]`) : null);
  if (existing) {
    if (existing.dataset && existing.dataset.loaded === '1') {
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      existing.addEventListener?.('load', () => {
        if (existing.dataset) existing.dataset.loaded = '1';
        resolve();
      }, { once: true });
      existing.addEventListener?.('error', () => reject(new Error(`Failed to load ${src}`)), { once: true });
    });
  }

  const script = doc.createElement('script');
  script.src = src;
  script.defer = true;
  script.async = true;
  script.crossOrigin = 'anonymous';
  script.referrerPolicy = 'no-referrer';
  if (key && script.dataset) script.dataset.lib = key;

  return new Promise((resolve, reject) => {
    const supportsEvents = typeof script.addEventListener === 'function';

    if (!supportsEvents) {
      try {
        doc.head.appendChild(script);
      } catch (_) {
        /* noop */
      }
      if (typeof setTimeout === 'function') {
        setTimeout(() => resolve(), 0);
      } else {
        resolve();
      }
      return;
    }

    script.onload = () => {
      if (key && script.dataset) script.dataset.loaded = '1';
      resolve();
    };
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    doc.head.appendChild(script);
  });
}

function autoTablePresent() {
  const { api, fn } = getAutoTableApi();
  if (!fn) return null;
  return { api, fn };
}

function graftAutoTableToCtor(ctor) {
  const found = autoTablePresent();
  if (!found || !ctor) return found;
  ctor.API = ctor.API || {};
  if (!ctor.API.autoTable && found.fn) {
    ctor.API.autoTable = found.fn;
  }
  return found;
}

function createAutoTableFallback() {
  const stub = function autoTableFallback(opts = {}) {
    const doc = this || {};
    const head = Array.isArray(opts.head) ? opts.head : [];
    const body = Array.isArray(opts.body) ? opts.body : [];
    const columns = Array.isArray(opts.columns) ? opts.columns : [];
    const startY = Number(opts.startY) || 0;
    const rowHeight = Number(opts.styles?.minCellHeight) || 12;

    const renderRow = (row, rowIndex, offset, section) => {
      const cells = Array.isArray(row) ? row : Object.values(row || {});
      const y = startY + (offset + rowIndex) * rowHeight;
      cells.forEach((value, columnIndex) => {
        const text = value?.content ?? value?.text ?? value;
        if (typeof doc.text === 'function') {
          try {
            doc.text(String(text ?? ''), 0, y + rowHeight / 2);
          } catch (_) {
            /* ignore text errors */
          }
        }
        if (typeof opts.didDrawCell === 'function') {
          const cell = { x: 0, y, width: 0, height: rowHeight, raw: text };
          try {
            opts.didDrawCell({
              cell,
              row: { index: rowIndex, raw: row },
              column: { index: columnIndex, raw: columns[columnIndex] },
              section,
              table: { startY },
            });
          } catch (_) {
            /* ignore callback errors */
          }
        }
      });
    };

    head.forEach((row, idx) => renderRow(row, idx, 0, 'head'));
    body.forEach((row, idx) => renderRow(row, idx, head.length, 'body'));

    return { head, body, options: opts };
  };

  globalThis.__tkAutoTableFallback = stub;

  const { ctor } = findExistingJsPDF();
  if (ctor) {
    ctor.API = ctor.API || {};
    ctor.API.autoTable = stub;
  }

  getGlobalCandidates().forEach((candidate) => {
    if (!candidate || typeof candidate !== 'object') return;
    const ctorCandidate = extractCtor(candidate);
    if (ctorCandidate) {
      ctorCandidate.API = ctorCandidate.API || {};
      ctorCandidate.API.autoTable = stub;
    }
    if (candidate.jspdf && typeof candidate.jspdf === 'object') {
      candidate.jspdf.autoTable = stub;
    }
    if (candidate.jsPDF && typeof candidate.jsPDF === 'function') {
      candidate.jsPDF.API = candidate.jsPDF.API || {};
      candidate.jsPDF.API.autoTable = stub;
    }
  });

  return { api: { autoTable: stub }, fn: stub };
}

async function ensureAutoTableLoaded() {
  if (autoTableReady && autoTablePresent()) return autoTablePresent();
  if (autoTablePending) return autoTablePending;

  autoTablePending = (async () => {
    const attemptSources = async (sources) => {
      for (const src of sources) {
        if (autoTablePresent()) return true;
        try {
          await injectScript(src, 'jspdf-autotable');
        } catch (error) {
          // Continue to the next source
          continue;
        }
      }
      return autoTablePresent();
    };

    await attemptSources(AUTOTABLE_LOCAL_SOURCES);
    const afterLocal = autoTablePresent();
    if (!afterLocal) {
      await attemptSources(AUTOTABLE_CDN_SOURCES);
    }

    const present = autoTablePresent();
    autoTableReady = !!present;
    if (!present) {
      return createAutoTableFallback();
    }
    if (cachedJsPDF) graftAutoTableToCtor(cachedJsPDF);
    return present;
  })().finally(() => {
    autoTablePending = null;
  });

  return autoTablePending;
}

async function loadJsPDFInternal() {
  const { ctor: existingCtor, scope } = findExistingJsPDF();
  if (existingCtor) {
    assignAliases(scope, existingCtor);
    await ensureAutoTableLoaded().catch(() => {});
    graftAutoTableToCtor(existingCtor);
    return existingCtor;
  }

  let lastError = null;

  const attemptSources = async (sources) => {
    for (const src of sources) {
      try {
        await injectScript(src, 'jspdf');
      } catch (error) {
        lastError = error;
        continue;
      }

      const { ctor, scope: loadedScope } = findExistingJsPDF();
      if (ctor) {
        assignAliases(loadedScope, ctor);
        return ctor;
      }
    }
    return null;
  };

  const localCtor = await attemptSources(LOCAL_SOURCES);
  if (localCtor) {
    await ensureAutoTableLoaded().catch(() => {});
    graftAutoTableToCtor(localCtor);
    return localCtor;
  }

  const cdnCtor = await attemptSources(CDN_SOURCES);
  if (cdnCtor) {
    await ensureAutoTableLoaded().catch(() => {});
    graftAutoTableToCtor(cdnCtor);
    return cdnCtor;
  }

  const { ctor: finalCtor, scope: finalScope } = findExistingJsPDF();
  if (finalCtor) {
    assignAliases(finalScope, finalCtor);
    await ensureAutoTableLoaded().catch(() => {});
    graftAutoTableToCtor(finalCtor);
    return finalCtor;
  }

  const error = new Error('jsPDF failed to load from local bundle or CDN');
  if (lastError) {
    error.cause = lastError;
  }
  throw error;
}

export async function ensureJsPDF() {
  const { ctor: existingCtor, scope } = findExistingJsPDF();
  if (existingCtor) {
    assignAliases(scope, existingCtor);
    cachedJsPDF = existingCtor;
    await ensureAutoTableLoaded().catch(() => {});
    graftAutoTableToCtor(existingCtor);
    return existingCtor;
  }

  if (cachedJsPDF) {
    cachedJsPDF = null;
  }

  if (!pendingLoad) {
    pendingLoad = loadJsPDFInternal()
      .then((ctor) => {
        cachedJsPDF = ctor;
        return ctor;
      })
      .finally(() => {
        pendingLoad = null;
      });
  }
  return pendingLoad;
}

/**
 * Load jsPDF from a CDN (falling back across mirrors).
 */
export async function loadJsPDF() {
  return ensureJsPDF();
}

export function __resetJsPDFForTesting() {
  cachedJsPDF = null;
  pendingLoad = null;
  autoTablePending = null;
  autoTableReady = false;
}
