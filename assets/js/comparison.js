(() => {
  const $ = (s, r=document)=>r.querySelector(s);

  let aData=null, bData=null;

  const fileA = $('#fileA');
  const fileB = $('#fileB');
  const chipA = $('#chipA');
  const chipB = $('#chipB');
  const btnExport = $('#btnExport');
  const drop = $('#dropzone');

  function setChip(chip, file){ chip.textContent = file.name; chip.hidden = false; }
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

  // Drag & drop
  ['dragenter','dragover'].forEach(ev=>drop?.addEventListener(ev, e=>{
    e.preventDefault(); drop.classList.add('is-drag');
  }));
  ['dragleave','drop'].forEach(ev=>drop?.addEventListener(ev, e=>{
    e.preventDefault(); drop.classList.remove('is-drag');
  }));
  drop?.addEventListener('drop', async e=>{
    const files = [...(e.dataTransfer?.files || [])].filter(f=>/\.json$/i.test(f.name)).slice(0,2);
    if(files[0]){ aData = await readJSON(files[0]); if(aData) setChip(chipA, files[0]); }
    if(files[1]){ bData = await readJSON(files[1]); if(bData) setChip(chipB, files[1]); }
    enableIfReady();
  });

  // Export
  btnExport?.addEventListener('click', ()=>{
    if(!(aData && bData)) return;
    if (typeof window.downloadCompatibilityPDF === 'function') {
      window.downloadCompatibilityPDF(aData, bData, { theme: document.documentElement.className });
    } else {
      alert('Export unavailable: missing PDF exporter. Check script order.');
    }
  });

  // COMPAT PAGE GUARD: prevent any survey/category boot if shared JS is bundled
  document.body.dataset.page === 'compat' && console.info('[compat] guard active');

})();
