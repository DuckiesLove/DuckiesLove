/**
 * Hotfix: stop init re-entry, normalize once, guard listeners,
 * ensure spinner clears even if init throws, and log long tasks.
 * Works in vanilla or React/Vue entry files.
 */

export const clamp0to5 = (n) => {
  const x = Number.isFinite(+n) ? +n : 0;
  return Math.max(0, Math.min(5, x));
};

let __normalizedOnce = false;
export function normalizeKinksOnce(raw) {
  if (__normalizedOnce) return raw;       // prevent repeat normalize → render loops
  __normalizedOnce = true;
  return Array.isArray(raw)
    ? raw.map(k => ({ ...k, rating: k.rating == null ? null : clamp0to5(k.rating) }))
    : raw;
}

/** Guard against wiring the same controls multiple times */
let __wired = false;
export function wireCategoryControlsSafely(doc = document) {
  if (__wired) return () => {};           // no-op if already wired
  __wired = true;

  const ids = ["selectAll","select-all","deselectAll","deselect-all"];
  const found = ids.map(id => doc.getElementById(id)).filter(Boolean);

  const ac = new AbortController();
  const { signal } = ac;

  for (const el of found) {
    const isSelect = /select[-]?all/i.test(el.id);
    el.addEventListener("click", () => {
      try {
        (isSelect ? window.selectAllCategories : window.deselectAllCategories)?.();
        window.updateCategoriesLeftUI?.();
      } catch (e) {
        console.error("[controls]", e);
      }
    }, { signal });
  }

  const startBtn = doc.querySelector("#start,#startSurvey");
  if (startBtn) startBtn.disabled = false;   // only if present

  return () => ac.abort();
}

/** Always clear spinner; also set a fallback timer so it can’t get stuck */
export function withSpinner(promiseLike) {
  try { window.showSpinner?.(); } catch {}
  const clear = () => { try { window.hideSpinner?.(); } catch {} };
  const fallback = setTimeout(clear, 7000);  // hard fail-safe
  const done = () => { clearTimeout(fallback); clear(); };
  return Promise.resolve(promiseLike).then(v => { done(); return v; })
    .catch(err => { done(); console.error("[init]", err); throw err; });
}

/** Debounced categories-left compute to avoid pegging the main thread */
export function computeCategoriesLeftDebounced(fn, wait = 150) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => {
      try { fn(...args); } catch (e) { console.error("[categories-left]", e); }
    }, wait);
  };
}

/** Log long tasks (helps confirm rendering loops) */
export function installLongTaskLogger() {
  try {
    new PerformanceObserver(list => {
      for (const e of list.getEntries()) {
        if (e.duration > 120) console.warn("[LongTask]", Math.round(e.duration) + "ms");
      }
    }).observe({ entryTypes: ["longtask"] });
  } catch {}
}

/** One-place boot wrapper you can call from your entry */
export async function safeBoot(loadDataAndRender) {
  installLongTaskLogger();
  await withSpinner(loadDataAndRender());
}
