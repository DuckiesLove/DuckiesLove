export function normalizeKey(s) {
  return String(s || '')
    .replace(/[\u2018\u2019\u2032]/g, "'")
    .replace(/[\u201C\u201D\u2033]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2026/g, '')
    .replace(/\s*\.\.\.\s*$/, '')
    .toLowerCase()
    .replace(/[\s\-_]+/g, ' ')
    .trim()
    .replace(/[^\p{L}\p{N} ]/gu, '')
    .replace(/\s+/g, ' ');
}

// Backward-compatible named export
export { normalizeKey as compatNormalizeKey };

// Expose for non-module scripts
if (typeof window !== 'undefined') window.compatNormalizeKey = normalizeKey;

