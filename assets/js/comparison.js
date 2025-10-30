(() => {
  const $ = (s, r=document)=>r.querySelector(s);

  let aData=null, bData=null;

  const fileA = $('#fileA');
  const fileB = $('#fileB');
  const chipA = $('#chipA');
  const chipB = $('#chipB');
  const btnExport = $('#btnDownloadPdf') || $('#btnExport');
  const SELF_KEY = 'tk_compat.self';
  const PARTNER_KEY = 'tk_compat.partner';
  const ALT_SELF_KEYS = ['talkkink:mine', 'talkkink:survey'];
  const ALT_PARTNER_KEY = 'talkkink:partner';

  function getTheme() {
    const doc = document.documentElement;
    const explicit = doc?.dataset?.theme || doc?.getAttribute?.('data-theme');
    if (explicit) return explicit;
    const classMatch = Array.from(doc?.classList || []).find(cls => /^(light|dark)$/i.test(cls));
    return (classMatch || 'dark').toLowerCase();
  }

  function storeCompat(key, data, fileName) {
    if (!data || typeof data !== 'object') return;
    let payload;
    try {
      payload = JSON.parse(JSON.stringify(data));
    } catch (err) {
      console.warn('[compat] unable to clone survey payload', err);
      return;
    }

    if (!payload.meta || typeof payload.meta !== 'object') {
      payload.meta = {};
    }
    if (!payload.meta.theme) {
      payload.meta.theme = getTheme();
    }
    if (fileName && !payload.meta.surveyTitle) {
      payload.meta.surveyTitle = fileName.replace(/\.[^.]+$/, '');
    }

    let serialized;
    try {
      serialized = JSON.stringify(payload);
    } catch (err) {
      console.warn('[compat] unable to persist survey payload', err);
      return;
    }

    const keysToStore = [key];
    if (key === SELF_KEY) keysToStore.push(...ALT_SELF_KEYS);
    if (key === PARTNER_KEY) keysToStore.push(ALT_PARTNER_KEY);

    keysToStore.forEach(name => {
      try {
        localStorage.setItem(name, serialized);
      } catch (err) {
        console.warn('[compat] unable to persist survey payload', err);
      }
    });

    if (key === SELF_KEY) {
      window.talkkinkMine = payload;
      window.talkkinkSurvey = payload;
    } else if (key === PARTNER_KEY) {
      window.talkkinkPartner = payload;
    }
  }

  function setChip(chip, file){ if(!chip) return; chip.textContent = file.name; chip.hidden = false; }
  function enableIfReady(){ if(btnExport) btnExport.disabled = !(aData && bData); }

  async function readJSON(file){
    const t = await file.text();
    try { return JSON.parse(t); } catch { alert(`Invalid JSON: ${file.name}`); return null; }
  }

  fileA?.addEventListener('change', async e=>{
    const f = e.target.files?.[0]; if(!f) return;
    aData = await readJSON(f);
    if(aData){
      setChip(chipA, f);
      storeCompat(SELF_KEY, aData, f.name);
    }
    enableIfReady();
  });
  fileB?.addEventListener('change', async e=>{
    const f = e.target.files?.[0]; if(!f) return;
    bData = await readJSON(f);
    if(bData){
      setChip(chipB, f);
      storeCompat(PARTNER_KEY, bData, f.name);
    }
    enableIfReady();
  });

  btnExport?.addEventListener('click', ()=>{
    if(!(aData && bData)) return;
    if (window.TKPDF && typeof window.TKPDF.download === 'function') {
      window.TKPDF.download();
    } else if (window.TKCompatPDF && typeof window.TKCompatPDF.generateFromStorage === 'function') {
      window.TKCompatPDF.generateFromStorage();
    } else if (typeof window.downloadCompatibilityPDF === 'function') {
      window.downloadCompatibilityPDF(aData, bData, { theme: document.documentElement.className });
    } else {
      alert('Export unavailable: missing PDF exporter. Check script order.');
    }
  });

  // page guard note
  document.body.dataset.page === 'compat' && console.info('[compat] stacked glow CTAs active');
})();
