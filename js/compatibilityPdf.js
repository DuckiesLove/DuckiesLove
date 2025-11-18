import {
  generateCompatibilityPDF,
  generateCompatibilityPDFLandscape,
  setCompatibilityPdfFontSettings,
} from '../docs/kinks/js/compatibilityPdf.js';

if (typeof window !== 'undefined') {
  window.generateCompatibilityPDF = generateCompatibilityPDF;
  window.generateCompatibilityPDFLandscape = generateCompatibilityPDFLandscape;
  window.setCompatibilityPdfFontSettings = setCompatibilityPdfFontSettings;
}

export { generateCompatibilityPDF, generateCompatibilityPDFLandscape, setCompatibilityPdfFontSettings };
