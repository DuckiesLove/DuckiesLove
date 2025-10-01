'use strict';

/**
 * tk-labels.js
 * Loads human-friendly labels for question ids:
 *  1) Base labels embedded below (safe defaults).
 *  2) Merge with /data/labels-overrides.json if it exists (optional).
 *  3) Exposes getLabel(id), collectMissing(ids), and downloadMissing(ids).
 *
 * This file is tiny, cached, and has zero build step.
 */

// --- 1) Base labels you already approved/used -------------------------------
// Keep adding here freely; overrides file can win later if you change phrasing.
// NOTE: Only a subset is shown; you can paste more any time.
const LABELS_BASE = {
  // Appearance Play (examples you saw on-screen)
  cb_zsnrb: "Dress partner’s outfit",
  cb_6jd2f: "Pick lingerie / base layers",
  cb_kgrnn: "Uniforms (school, military, nurse, etc.)",
  cb_169ma: "Time-period dress-up",
  cb_4yyxa: "Dollification / polished object aesthetics",
  cb_2c0f9: "Hair-based play (brushing, ribbons, tying)",
  cb_qwnhi: "Head coverings / symbolic hoods",
  cb_zvchg: "Coordinated looks / dress codes",
  cb_qw9jg: "Ritualized grooming",
  cb_3ozhq: "Praise for pleasing visual display",
  cb_hqakm: "Formal appearance protocols",
  cb_rn136: "Clothing as power-role signal",

  // Items you asked for specifically:
  cb_wwf76: "Makeup as protocol or control",
  cb_swujj: "Accessory or ornament rules",
  cb_k55xd: "Wardrobe restrictions or permissions",

  // If you already know more ids → add them here now or via overrides file.
};

// --- 2) Try to load OPTIONAL site overrides --------------------------------
// IMPORTANT: 404s must NOT freeze the page.
let LABELS_EXTRA = {};
(async () => {
  try {
    const res = await fetch('/data/labels-overrides.json', { cache: 'no-store' });
    if (res.ok) {
      LABELS_EXTRA = await res.json();
      document.dispatchEvent(new CustomEvent('tk-labels:ready'));
    }
  } catch (_err) {
    // ignore – optional file
  }
})();

/** Merge base + overrides at read time. */
function getLabel(id) {
  return LABELS_EXTRA[id] ?? LABELS_BASE[id] ?? id;
}

/** Given a Set or Array of ids, return those still missing labels. */
function collectMissing(ids) {
  const arr = Array.from(ids || []);
  return arr.filter(id => !(id in LABELS_BASE) && !(id in LABELS_EXTRA));
}

/** Offer a client-side download of missing keys as a JSON template. */
function downloadMissing(ids) {
  const missing = collectMissing(ids).reduce((obj, id) => {
    obj[id] = ''; // fill me in
    return obj;
  }, {});
  const blob = new Blob([JSON.stringify(missing, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'labels-overrides.template.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

const api = { getLabel, collectMissing, downloadMissing };

if (typeof window !== 'undefined') {
  window.tkLabels = api;
  // Maintain compatibility with older helpers that looked for TK_LABELS
  window.TK_LABELS = api;
  window.TKLabels = api;
}
