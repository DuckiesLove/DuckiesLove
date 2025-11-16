import {
  generateCompatibilityPDF,
  generateCompatibilityPDFLandscape
} from '../docs/kinks/js/compatibilityPdf.js';

if (typeof window !== 'undefined') {
  window.generateCompatibilityPDF = generateCompatibilityPDF;
  window.generateCompatibilityPDFLandscape = generateCompatibilityPDFLandscape;
}

export { generateCompatibilityPDF, generateCompatibilityPDFLandscape };
