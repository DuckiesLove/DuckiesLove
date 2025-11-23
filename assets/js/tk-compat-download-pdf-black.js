;(function(){
  'use strict';

  const FALLBACK_QUESTIONS = [
    { id: 'q1', text: "Choosing my partner’s outfit for the day", cat: 'Appearance Play' },
    { id: 'q2', text: "Praise / degradation in roleplay",        cat: 'Behavioral Play' },
    { id: 'q3', text: "Wax play",                                 cat: 'Sensation Play' },
    { id: 'q4', text: "Bondage (rope/shibari)",                   cat: 'Bondage & Suspension' },
    { id: 'q5', text: "Exhibitionism in semi-public contexts",    cat: 'Voyeurism / Exhibitionism' }
  ];

  const FALLBACK_ANSWERS = new Map([
    ['q1', 4], ['q2', 3], ['q3', 2], ['q4', 5], ['q5', 1]
  ]);

  function getJsPdfCtor(){
    const ctor = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
    if (!ctor) {
      throw new Error('[tk-pdf] jsPDF unavailable — ensure the library is loaded before tk-compat-download-pdf-black.js');
    }
    return ctor;
  }

  function ensureAutoTable(doc){
    if (doc && typeof doc.autoTable === 'function') return;
    const api = (window.jspdf && window.jspdf.jsPDF && window.jspdf.jsPDF.API) || (window.jsPDF && window.jsPDF.API);
    if (api && typeof api.autoTable === 'function' && doc) {
      doc.autoTable = function autoTableProxy(){
        return api.autoTable.apply(this, arguments);
      };
    }
    if (!doc || typeof doc.autoTable !== 'function') {
      throw new Error('[tk-pdf] jsPDF autoTable plugin unavailable — load it before the exporter');
    }
  }

  function groupByCategory(questions, answersMap){
    const grouped = new Map();
    questions.forEach((question) => {
      const id = question?.id != null ? String(question.id) : '';
      if (!id) return;
      const cat = question.cat || question.category || question.section || 'Other';
      const entry = grouped.get(cat) || [];
      entry.push({
        score: answersMap.get(id),
        text: question.text || question.prompt || question.label || question.title || id
      });
      grouped.set(cat, entry);
    });
    return grouped;
  }

  function normalizeAnswers(input){
    if (!input) return new Map();
    if (input instanceof Map) return input;
    if (Array.isArray(input)) {
      return new Map(input.map((row) => {
        if (!row) return [null, null];
        const id = row.id ?? row[0];
        const rawVal = row.score ?? row.value ?? row.answer ?? row.rating ?? row[1];
        if (id == null) return [null, null];
        return [String(id), Number(rawVal)];
      }).filter((pair) => pair[0] != null));
    }
    if (typeof input === 'object') {
      return new Map(Object.entries(input).map(([id, value]) => [String(id), Number(value)]));
    }
    return new Map();
  }

  function detectData(){
    const hasReal = Array.isArray(window.QUESTIONS) && window.answers && typeof window.answers.get === 'function';
    if (hasReal) {
      return { questions: window.QUESTIONS, answersMap: window.answers };
    }

    if (Array.isArray(window.QUESTIONS) && window.answers) {
      return { questions: window.QUESTIONS, answersMap: normalizeAnswers(window.answers) };
    }

    return { questions: FALLBACK_QUESTIONS, answersMap: FALLBACK_ANSWERS };
  }

  function formatDate(){
    return new Date().toLocaleString();
  }

  function paintPage(doc, colors, pageSize, chapterTitle){
    const { BLACK, CYAN, MUTE, TEXT } = colors;
    const { width, height } = pageSize;
    const centerX = width / 2;

    doc.setFillColor(...BLACK);
    doc.rect(0, 0, width, height, 'F');

    doc.setTextColor(...CYAN);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.text('Talk Kink — Survey Results', centerX, 48, { align: 'center' });

    const stamp = formatDate();
    doc.setTextColor(...MUTE);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    const sub = chapterTitle ? `${stamp}  •  ${chapterTitle}` : stamp;
    doc.text(sub, centerX, 66, { align: 'center' });

    const pageStr = `Page ${doc.getNumberOfPages()}`;
    const tw = doc.getTextWidth(pageStr);
    doc.text(pageStr, width - 40 - tw, height - 24);
  }

  function generateResultsPDF(questions, answersMap, opts){
    const options = Object.assign({ openInNewTab: true, filename: 'talkkink-results.pdf' }, opts);
    const ctor = getJsPdfCtor();
    const doc = new ctor({ orientation: 'portrait', unit: 'pt', format: 'letter' });
    ensureAutoTable(doc);

    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const colors = {
      BLACK: [0, 0, 0],
      CYAN: [0, 229, 255],
      MUTE: [155, 211, 224],
      TEXT: [223, 247, 255],
      LINES: [0, 190, 210]
    };

    const grouped = groupByCategory(Array.isArray(questions) ? questions : [], normalizeAnswers(answersMap));

    function paint(chapter){
      paintPage(doc, colors, { width: pageW, height: pageH }, chapter);
    }

    const tableCommon = {
      theme: 'grid',
      styles: {
        fillColor: colors.BLACK,
        textColor: colors.TEXT,
        lineColor: colors.LINES,
        lineWidth: 0.6,
        tableLineColor: colors.LINES,
        tableLineWidth: 0.6,
        fontSize: 11,
        cellPadding: { top: 6, right: 8, bottom: 6, left: 8 }
      },
      bodyStyles: {
        fillColor: colors.BLACK,
        textColor: colors.TEXT,
        lineColor: colors.LINES,
        lineWidth: 0.6
      },
      alternateRowStyles: {
        fillColor: colors.BLACK,
        textColor: colors.TEXT,
        lineColor: colors.LINES
      },
      headStyles: {
        fillColor: colors.BLACK,
        textColor: colors.CYAN,
        lineColor: colors.LINES,
        lineWidth: 0.8,
        fontStyle: 'bold'
      },
      margin: { left: 40, right: 40 },
      willDrawPage: (data) => {
        paint(data?.settings?.userStyles?.chapterTitle || '');
      },
      didParseCell: (data) => {
        if (data.cell.section === 'head') {
          data.cell.styles.fillColor = colors.BLACK;
          data.cell.styles.textColor = colors.CYAN;
        } else if (data.cell.section === 'body') {
          data.cell.styles.fillColor = colors.BLACK;
          data.cell.styles.textColor = colors.TEXT;
        }
        data.cell.styles.lineColor = colors.LINES;
      }
    };

    paint('Summary');
    doc.setTextColor(...colors.TEXT);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(28);
    doc.text('Summary by Category', 40, 110);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    doc.setTextColor(...colors.MUTE);
    doc.text('Scores: 0 = skip • 1 = hard limit • 2 = soft limit • 3 = curious • 4 = enjoy • 5 = favorite', 40, 136);

    let y = 160;
    const ordered = [...grouped.entries()].sort((a, b) => String(a[0] || '').localeCompare(String(b[0] || '')));

    for (const [cat, items] of ordered) {
      if (y > pageH - 120) {
        doc.addPage();
        paint(cat || 'Other');
        y = 80;
      }
      doc.setTextColor(...colors.CYAN);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.text(cat || 'Other', 40, y);
      y += 14;

      const rows = items.map((item) => [
        item.score == null || Number.isNaN(item.score) ? '–' : String(item.score),
        item.text
      ]);

      doc.autoTable(Object.assign({}, tableCommon, {
        head: [['Score', 'Kinks']],
        body: rows,
        startY: y + 10,
        userStyles: { chapterTitle: cat || 'Other' }
      }));

      y = doc.lastAutoTable.finalY + 24;
    }

    if (options.openInNewTab) {
      const blobUrl = doc.output('bloburl');
      window.open(blobUrl, '_blank', 'noopener,noreferrer');
    } else {
      doc.save(options.filename);
    }

    return doc;
  }

  function downloadHandler(customOpts){
    try {
      const { questions, answersMap } = detectData();
      return generateResultsPDF(questions, answersMap, customOpts);
    } catch (error) {
      console.error('[tk-pdf] Failed to generate PDF', error);
      alert('Sorry — PDF export is unavailable right now.');
      return null;
    }
  }

  window.downloadKinkPDF = function downloadKinkPDF(options){
    return downloadHandler(options);
  };

  function bindDemoButton(){
    const btn = document.getElementById('btnDownloadPDF');
    if (!btn || btn.__tkPdfBound) return;
    btn.__tkPdfBound = true;
    btn.addEventListener('click', () => downloadHandler({ openInNewTab: true }));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindDemoButton, { once: true });
  } else {
    bindDemoButton();
  }
})();
