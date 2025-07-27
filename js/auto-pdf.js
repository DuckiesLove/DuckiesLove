const exportToPDF = () => {
  const element = document.getElementById('pdf-container');
  const opt = {
    margin: 0,
    filename: 'kink-compatibility-results.pdf',
    image: { type: 'jpeg', quality: 1 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      backgroundColor: '#000'
    },
    jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' },
    pagebreak: { mode: ['avoid-all'] }
  };
  html2pdf().set(opt).from(element).save();
};

document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('download');
  if (btn) btn.addEventListener('click', exportToPDF);
});
