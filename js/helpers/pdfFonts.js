import {
  DEJAVU_SANS_BOLD,
  DEJAVU_SANS_NORMAL,
  PDF_FONT_NAME_BOLD,
  PDF_FONT_NAME_NORMAL,
} from './pdfFontData.js';

const PDF_FONT_FAMILY = 'DejaVuSans';
const registeredDocs = new WeakSet();

export async function registerPdfFonts(doc) {
  if (!doc || registeredDocs.has(doc)) return;
  if (typeof doc.addFileToVFS !== 'function' || typeof doc.addFont !== 'function') {
    registeredDocs.add(doc);
    return;
  }
  doc.addFileToVFS(PDF_FONT_NAME_NORMAL, DEJAVU_SANS_NORMAL);
  doc.addFileToVFS(PDF_FONT_NAME_BOLD, DEJAVU_SANS_BOLD);
  doc.addFont(PDF_FONT_NAME_NORMAL, PDF_FONT_FAMILY, 'normal');
  doc.addFont(PDF_FONT_NAME_BOLD, PDF_FONT_FAMILY, 'bold');
  registeredDocs.add(doc);
}

export async function setHeaderFont(doc) {
  await registerPdfFonts(doc);
  doc.setFont(PDF_FONT_FAMILY, 'bold');
}

export async function setBodyFont(doc) {
  await registerPdfFonts(doc);
  doc.setFont(PDF_FONT_FAMILY, 'normal');
}

export { PDF_FONT_FAMILY };

const api = { registerPdfFonts, setHeaderFont, setBodyFont, PDF_FONT_FAMILY };
if (typeof window !== 'undefined') {
  window.tkPdfFonts = api;
}

export default api;
