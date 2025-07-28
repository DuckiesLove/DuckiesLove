const exportToPDF = () => {
  const element = document.getElementById('pdf-container');
  document.body.classList.add('exporting');

  const opt = {
    margin: 0,
    filename: 'Kink_Compatibility_Report.pdf',
    image: { type: 'jpeg', quality: 1 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      backgroundColor: '#000',
      scrollY: 0
    },
    jsPDF: {
      unit: 'mm',
      format: 'a3',
      orientation: 'landscape'
    },
    pagebreak: {
      mode: ['css', 'legacy'],
      avoid: ['.avoid-break']
    }
  };
  html2pdf()
    .set(opt)
    .from(element)
    .save()
    .then(() => {
      document.body.classList.remove('exporting');
    });
};
