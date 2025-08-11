export function compatNormalizeKey(s){
  return String(s || '')
    .replace(/[\u2018\u2019\u2032]/g,"'")
    .replace(/[\u201C\u201D\u2033]/g,'"')
    .replace(/[\u2013\u2014]/g,'-')
    .replace(/\u2026/g,'')
    .replace(/\s*\.\.\.\s*$/,'')
    .replace(/\s+/g,' ')
    .trim()
    .toLowerCase();
}

if (typeof window !== 'undefined') window.compatNormalizeKey = compatNormalizeKey;

