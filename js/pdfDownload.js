import { applyPrintStyles } from './theme.js';

// Attach click handler for the Download PDF button
window.addEventListener('DOMContentLoaded', () => {
  const downloadBtn = document.getElementById('downloadPdfBtn');
  if (!downloadBtn) return;

  downloadBtn.addEventListener('click', () => {
    const data = window.compatibilityData;
    const categories = Array.isArray(data) ? data : data?.categories;
    if (!categories || categories.length === 0) {
      alert('Both surveys must be uploaded before generating PDF.');
      return;
    }

const partnerAData = {};
const partnerBData = {};
categories.forEach(cat => {
  const name = cat.category || cat.name;
  partnerAData[name] = {};
  partnerBData[name] = {};
  (cat.items || []).forEach(item => {
    const label = item.label || item.kink || item.name;
    const scoreA = typeof item.a === 'number'
      ? item.a
      : typeof item.partnerA === 'number'
        ? item.partnerA
        : typeof item.scoreA === 'number'
          ? item.scoreA
          : undefined;
    const scoreB = typeof item.b === 'number'
      ? item.b
      : typeof item.partnerB === 'number'
        ? item.partnerB
        : typeof item.scoreB === 'number'
          ? item.scoreB
          : undefined;
    partnerAData[name][label] = scoreA;
    partnerBData[name][label] = scoreB;
  });
});

const activeTheme =
  localStorage.getItem('theme') ||
  [...document.body.classList]
    .find(cls => cls.startsWith('theme-'))?.replace('theme-', '') ||
  'dark';

const themeOptions = {
  dark: {
    bgColor: '#000000',
    textColor: '#ffffff',
    barFillColor: '#000000',
    barTextColor: '#ffffff',
    font: 'helvetica'
  },
  lipstick: {
    bgColor: '#1a001f',
    textColor: '#fceaff',
    barFillColor: '#ff90cb',
    barTextColor: '#1a001f',
    font: 'times'
  },
  forest: {
    bgColor: '#f0f7f1',
    textColor: '#1d3b1d',
    barFillColor: '#81b89b',
    barTextColor: '#1d3b1d',
    font: 'courier'
  }
};

const themeSettings = themeOptions[activeTheme] || themeOptions.dark;

// Preferred method: html2pdf if available
if (typeof window.html2pdf === 'function') {
  applyPrintStyles(activeTheme);

  const element = document.getElementById('pdf-container');
  if (!element) {
    alert('PDF content not found.');
    return;
  }

  window.scrollTo(0, 0);
  window.html2pdf()
    .set({
      margin: 0,
      filename: 'kink-compatibility.pdf',
      image: { type: 'jpeg', quality: 1 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        backgroundColor: themeSettings.bgColor,
        scrollY: 0
      },
      jsPDF: { unit: 'in', format: 'letter', orientation: 'landscape' },
      pagebreak: { mode: ['avoid-all'] },
    })
    .from(element)
    .save();
} else {
  // Fallback: Use jsPDF rendering directly
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape' });

  generateCompatibilityPDF(partnerAData, partnerBData, doc, themeSettings);
  doc.save('kink-compatibility.pdf');
}

  });
});

export {};
