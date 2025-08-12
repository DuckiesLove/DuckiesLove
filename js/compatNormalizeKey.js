export function normalizeKey(s) {
  return (s || '')
    .toString()
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

