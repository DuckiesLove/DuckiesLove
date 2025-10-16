(() => {
  const $ = (s, r=document)=>r.querySelector(s);

  let aData=null, bData=null;

  const fileA = $('#fileA');
  const fileB = $('#fileB');
  const chipA = $('#chipA');
  const chipB = $('#chipB');
  const btnExport = $('#btnExport');

  function setChip(chip, file){ if(!chip) return; chip.textContent = file.name; chip.hidden = false; }
  function enableIfReady(){ if(btnExport) btnExport.disabled = !(aData && bData); }

  async function readJSON(file){
    const t = await file.text();
    try { return JSON.parse(t); } catch { alert(`Invalid JSON: ${file.name}`); return null; }
  }

  fileA?.addEventListener('change', async e=>{
    const f = e.target.files?.[0]; if(!f) return;
    aData = await readJSON(f); if(aData) setChip(chipA, f); enableIfReady();
  });
  fileB?.addEventListener('change', async e=>{
    const f = e.target.files?.[0]; if(!f) return;
    bData = await readJSON(f); if(bData) setChip(chipB, f); enableIfReady();
  });

  btnExport?.addEventListener('click', ()=>{
    if(!(aData && bData)) return;
    if (typeof window.downloadCompatibilityPDF === 'function') {
      window.downloadCompatibilityPDF(aData, bData, { theme: document.documentElement.className });
    } else {
      alert('Export unavailable: missing PDF exporter. Check script order.');
    }
  });

  // page guard note
  document.body.dataset.page === 'compat' && console.info('[compat] stacked glow CTAs active');
})();
