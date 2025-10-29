const DEFAULT_FILENAME = 'talkkink-survey-results.pdf';

function getDocumentRef() {
  return typeof document !== 'undefined' ? document : null;
}

function getWindowRef() {
  if (typeof window !== 'undefined') return window;
  if (typeof globalThis !== 'undefined' && globalThis.window) return globalThis.window;
  return null;
}

export function isJsPDF(obj) {
  return Boolean(obj && typeof obj.output === 'function');
}

function base64ToUint8Array(base64) {
  if (typeof atob === 'function') {
    const binStr = atob(base64);
    const len = binStr.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i += 1) {
      bytes[i] = binStr.charCodeAt(i);
    }
    return bytes;
  }
  if (typeof Buffer !== 'undefined') {
    return Uint8Array.from(Buffer.from(base64, 'base64'));
  }
  throw new Error('No base64 decoder available in this environment.');
}

export function dataUrlToBlob(dataUrl) {
  if (typeof dataUrl !== 'string') {
    throw new Error('Data URL must be a string.');
  }
  const parts = dataUrl.split(',');
  if (parts.length < 2) throw new Error('Invalid data URL');
  const meta = parts[0];
  const base64 = parts.slice(1).join(',');
  const mimeMatch = meta.match(/^data:(.*?);/);
  const mime = mimeMatch && mimeMatch[1] ? mimeMatch[1] : 'application/pdf';
  const bytes = base64ToUint8Array(base64);
  return new Blob([bytes], { type: mime || 'application/pdf' });
}

export async function toBlob(input) {
  if (isJsPDF(input)) {
    const blobResult = input.output('blob');
    return blobResult instanceof Promise ? await blobResult : blobResult;
  }

  if (typeof Blob !== 'undefined' && input instanceof Blob) {
    return input;
  }

  if (input instanceof ArrayBuffer) {
    return new Blob([new Uint8Array(input)], { type: 'application/pdf' });
  }

  if (input instanceof Uint8Array) {
    return new Blob([input], { type: 'application/pdf' });
  }

  if (typeof input === 'string' && input.startsWith('data:')) {
    return dataUrlToBlob(input);
  }

  if (typeof input === 'string' && input.startsWith('blob:')) {
    return input;
  }

  throw new Error('Unsupported PDF input for download.');
}

function ensureDomForDownload() {
  const doc = getDocumentRef();
  const win = getWindowRef();
  if (!doc) {
    throw new Error('Document is not available.');
  }
  if (!win) {
    throw new Error('Window is not available.');
  }
  const anchor = typeof doc.createElement === 'function' ? doc.createElement('a') : null;
  if (!anchor) {
    throw new Error('Failed to create anchor for download.');
  }
  if (typeof anchor.click !== 'function') {
    throw new Error('Download anchor cannot be clicked programmatically.');
  }
  anchor.remove?.();
  if (typeof win.URL === 'undefined' || typeof win.URL.createObjectURL !== 'function') {
    throw new Error('URL.createObjectURL is not available.');
  }
  return { doc, win };
}

function saveAsUrl(url, filename, doc) {
  const documentRef = doc || getDocumentRef();
  if (!documentRef) {
    throw new Error('Document is not available.');
  }
  if (typeof documentRef.createElement !== 'function') {
    throw new Error('document.createElement is not available.');
  }
  const anchor = documentRef.createElement('a');
  if (!anchor || typeof anchor.click !== 'function') {
    throw new Error('Download anchor cannot be clicked programmatically.');
  }
  anchor.href = url;
  anchor.download = filename || DEFAULT_FILENAME;
  anchor.style.display = 'none';

  const container = documentRef.body || documentRef.documentElement || documentRef.head;
  if (!container || typeof container.appendChild !== 'function') {
    throw new Error('No append target available for download link.');
  }
  container.appendChild(anchor);
  anchor.click();
  anchor.remove?.();
}

export async function savePDF(input, filename = DEFAULT_FILENAME) {
  const { win } = ensureDomForDownload();

  if (typeof input === 'string' && input.startsWith('blob:')) {
    saveAsUrl(input, filename);
    return;
  }

  const blob = await toBlob(input);

  if (typeof blob === 'string') {
    saveAsUrl(blob, filename);
    return;
  }

  const url = win.URL.createObjectURL(blob);
  try {
    saveAsUrl(url, filename);
  } finally {
    if (typeof win.URL.revokeObjectURL === 'function') {
      setTimeout(() => {
        try {
          win.URL.revokeObjectURL(url);
        } catch (_) {
          /* ignore */
        }
      }, 4000);
    }
  }
}

const namespace = { savePDF, toBlob, dataUrlToBlob, isJsPDF };

if (typeof globalThis !== 'undefined') {
  const existing = typeof globalThis.TalkKinkDownload === 'object' && globalThis.TalkKinkDownload
    ? globalThis.TalkKinkDownload
    : {};
  existing.savePDF = savePDF;
  existing.toBlob = toBlob;
  existing.dataUrlToBlob = dataUrlToBlob;
  existing.isJsPDF = isJsPDF;
  globalThis.TalkKinkDownload = existing;
}

export default namespace;
