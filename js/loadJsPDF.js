let cachedJsPDF = null;
let pendingLoad = null;

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
  }
  if (typeof globalThis.window === 'undefined' || globalThis.window == null) {
    globalThis.window = scope || globalThis;
  }
  if (typeof globalThis.jsPDF !== 'function') {
    globalThis.jsPDF = ctor;
  }
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

async function importFrom(rel) {
  const url = new URL(rel, import.meta.url);
  await import(/* @vite-ignore */ url.href);
}

async function loadJsPDFInternal() {
  const { ctor: existingCtor, scope } = findExistingJsPDF();
  if (existingCtor) {
    assignAliases(scope, existingCtor);
    return existingCtor;
  }

  const sources = [
    './vendor/jspdf.umd.min.js',
    '../vendor/jspdf.umd.min.js',
    '../assets/js/vendor/jspdf.umd.min.js',
  ];

  let lastError = null;
  for (const rel of sources) {
    try {
      await importFrom(rel);
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

  const { ctor: finalCtor, scope: finalScope } = findExistingJsPDF();
  if (finalCtor) {
    assignAliases(finalScope, finalCtor);
    return finalCtor;
  }

  const error = new Error('jsPDF failed to load');
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
    return existingCtor;
  }

  if (cachedJsPDF) {
    // Cached reference is no longer present globally; reload to recover.
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
 * Load the locally bundled jsPDF library. The vendor file is included in the
 * repository so no network access is required.
 */
export async function loadJsPDF() {
  return ensureJsPDF();
}

export function __resetJsPDFForTesting() {
  cachedJsPDF = null;
  pendingLoad = null;
}
