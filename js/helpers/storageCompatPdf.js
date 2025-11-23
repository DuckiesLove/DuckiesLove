import { buildCategoriesFromSurveys } from '../pdfDownload.js';

function toNumberOrNull(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function computeMatchPercent(aScore, bScore) {
  if (!Number.isFinite(aScore) || !Number.isFinite(bScore)) return null;
  const percent = Math.max(0, Math.min(100, Math.round(100 - Math.abs(aScore - bScore) * 20)));
  return percent;
}

function formatValue(val) {
  if (val === undefined || val === null || val === '') return 'N/A';
  if (typeof val === 'string') return val;
  if (typeof val === 'number' && Number.isFinite(val)) return val.toString();
  return String(val);
}

export function buildCompatCategories(partnerA, partnerB, metadata = {}) {
  const categories = buildCategoriesFromSurveys(partnerA, partnerB);
  const title = metadata?.categoryLabel || metadata?.title || '';

  return categories.map((category) => {
    const name = category?.category || category?.label || '';
    const items = (category?.items || []).map((item) => {
      const partnerAScore = toNumberOrNull(item?.partnerA ?? item?.a ?? item?.scoreA);
      const partnerBScore = toNumberOrNull(item?.partnerB ?? item?.b ?? item?.scoreB);
      return {
        label: item?.label || item?.name || '—',
        partnerA: partnerAScore,
        compatibility: computeMatchPercent(partnerAScore, partnerBScore),
        partnerB: partnerBScore,
      };
    });

    return {
      label: name || title || 'Compatibility Results',
      items,
    };
  });
}

export function renderCompatCategoryTable(doc, categories, startY = 0) {
  let finalY = startY;

  (categories || []).forEach((category) => {
    const data = (category.items || []).map((item) => [
      item.label,
      formatValue(item.partnerA),
      formatValue(item.compatibility),
      formatValue(item.partnerB),
    ]);

    doc.autoTable({
      startY: finalY,
      head: [['Kink', 'Partner A', 'Match', 'Partner B']],
      body: data,
      styles: {
        textColor: '#FFFFFF',
        fontSize: 10,
        cellPadding: 3,
      },
      headStyles: {
        fillColor: [0, 255, 255],
        textColor: [0, 0, 0],
        halign: 'center',
      },
      columnStyles: {
        1: { halign: 'center' },
        2: { halign: 'center' },
        3: { halign: 'center' },
      },
      didDrawPage: (data) => {
        finalY = data.cursor?.y || startY + 10;
      },
    });

    finalY += 10;
  });

  return finalY;
}

function ensureDocument(doc) {
  if (doc) return doc;
  const ctor = window?.jspdf?.jsPDF || window?.jsPDF;
  if (!ctor) {
    throw new Error('jsPDF is not available. Include the library before generating PDFs.');
  }
  return new ctor({ unit: 'pt', format: 'a4', orientation: 'portrait' });
}

export async function generateFromStorage(doc, storageData) {
  const workingDoc = ensureDocument(doc);
  const parsed = typeof storageData === 'string' ? JSON.parse(storageData || '{}') : storageData || {};
  const { partnerA, partnerB, metadata } = parsed;
  const categories = buildCompatCategories(partnerA, partnerB, metadata);

  const titleY = 40;
  workingDoc.setTextColor(0, 255, 255);
  workingDoc.setFontSize(22);
  workingDoc.text('Compatibility Results', workingDoc.internal.pageSize.getWidth() / 2, titleY, { align: 'center' });

  renderCompatCategoryTable(workingDoc, categories, titleY + 10);

  workingDoc.save('TalkKink_Compatibility_Results.pdf');
  return workingDoc;
}
