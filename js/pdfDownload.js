/* Black PDF, full-width, Category column only (no Flag column) — live DOM untouched */
const PDF_DEBUG_SHOW_CLONE = false;
const STRIP_IMAGES_IN_PDF = true;
const PDF_ORIENTATION = 'landscape';

function assertLibsOrThrow(){
  const jsPDFCtor = (window.jspdf && window.jspdf.jsPDF) || (window.jsPDF && window.jsPDF.jsPDF);
  if (!window.html2canvas) throw new Error('html2canvas missing (load CDN before this file).');
  if (!jsPDFCtor)         throw new Error('jsPDF missing (load CDN before this file).');
  return jsPDFCtor;
}

/* PDF-only CSS (applies only to the cloned .pdf-export tree) */
(function injectPdfCSS(){
  if (document.querySelector('style[data-pdf-style]')) return;
  const css = `
  .pdf-export{background:#000!important;color:#fff!important;padding:18px!important;margin:0!important}
  .pdf-export, .pdf-export * { max-width:none!important; }
  .pdf-export .compat-section{break-inside:avoid-page!important;page-break-inside:avoid!important;margin:0 0 10pt 0!important}
  .pdf-export table{width:100%!important;border-collapse:collapse!important;table-layout:auto!important;background:transparent!important;color:#fff!important}
  .pdf-export thead th{font-weight:800!important;text-align:center!important;white-space:nowrap!important}
  .pdf-export th,.pdf-export td{border:none!important;padding:7px 10px!important;line-height:1.25!important;vertical-align:middle!important;box-sizing:border-box!important;page-break-inside:avoid!important;break-inside:avoid!important}
  .pdf-export .col-cat, .pdf-export .col-desc {text-align:left!important;white-space:normal!important}
  .pdf-export .col-a, .pdf-export .col-match, .pdf-export .col-b {text-align:center!important;white-space:nowrap!important}
  .pdf-export .col-cat   {width:18%!important}
  .pdf-export .col-desc  {width:60%!important}
  .pdf-export .col-a     {width:7%!important}
  .pdf-export .col-match {width:7%!important}
  .pdf-export .col-b     {width:8%!important}
  `;
  const s=document.createElement('style'); s.setAttribute('data-pdf-style','true'); s.textContent=css; document.head.appendChild(s);
})();

/* ---------- helpers ---------- */
function stripHeaderEmoji(root=document){
  const re=/[\p{Extended_Pictographic}\p{Emoji_Presentation}]/gu;
  root.querySelectorAll('.section-title,.category-header,.compat-category,th').forEach(n=>{
    const t=(n.textContent||'').replace(re,'').trim(); if(t) n.textContent=t;
  });
}
async function waitUntilReady(container){
  if (document.fonts?.ready) { try{ await document.fonts.ready; }catch(_){} }
  const t0=Date.now();
  while(true){
    const hasRows=[...container.querySelectorAll('table tbody')].some(tb=>tb.children?.length>0);
    if (hasRows) break;
    if (Date.now()-t0>6000) break;
    await new Promise(r=>setTimeout(r,100));
  }
  await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
}
function forceTableDisplay(root){
  root.querySelectorAll('table').forEach(e=>e.style.display='table');
  root.querySelectorAll('thead').forEach(e=>e.style.display='table-header-group');
  root.querySelectorAll('tbody').forEach(e=>e.style.display='table-row-group');
  root.querySelectorAll('tr').forEach(e=>e.style.display='table-row');
  root.querySelectorAll('td,th').forEach(e=>e.style.display='table-cell');
}
function stripProblemImages(root){ if (!STRIP_IMAGES_IN_PDF) return; root.querySelectorAll('img').forEach(i=>i.remove()); }

/* ====== 1) PDF-only CSS (once) ====== */
(function injectPdfColumnFixCSS(){
  if (document.querySelector('style[data-pdf-column-fix]')) return;
  const css = `
    .pdf-export table{ table-layout:fixed!important; width:100%!important; border-collapse:collapse!important }
    .pdf-export th,.pdf-export td{ padding:7px 10px!important; vertical-align:top!important; color:#fff!important; background:transparent!important }
    /* Final layout after fix: 1) Category  2) Partner A  3) Match  4) Partner B */
    .pdf-export tr > *:nth-child(1){ width:64%!important; text-align:left!important; white-space:normal!important }
    .pdf-export tr > *:nth-child(2),
    .pdf-export tr > *:nth-child(3),
    .pdf-export tr > *:nth-child(4){ width:12%!important; text-align:center!important; white-space:nowrap!important }
  `;
  const s=document.createElement('style'); s.setAttribute('data-pdf-column-fix','true'); s.textContent=css;
  document.head.appendChild(s);
})();

/* ====== 2) Helper: normalize ONE table in the CLONE ====== */
function fixOneTable(table){
  const headRow = table.querySelector('thead tr');
  const bodyRows = table.querySelectorAll('tbody tr');
  if (!headRow || !bodyRows.length) return;

  // Remove any Flag / Flag-Star column
  const headers = Array.from(headRow.children).map(th => (th.textContent||'').trim().toLowerCase());
  const idxFlag = headers.findIndex(h => /^flag(\/star)?$/.test(h));
  if (idxFlag > -1){
    headRow.children[idxFlag].remove();
    bodyRows.forEach(tr => tr.children[idxFlag] && tr.children[idxFlag].remove());
  }

  // Identify key columns by header text
  function hIdx(re){ const ths=[...table.querySelector('thead tr').children]; return ths.findIndex(th=>re.test((th.textContent||'').trim().toLowerCase())); }
  let iCat   = hIdx(/^category$/);
  const iA   = hIdx(/partner\s*a/);
  const iM   = hIdx(/\bmatch\b/);
  const iB   = hIdx(/partner\s*b/);

  // Find likely "description" column: first column that isn't Cat/A/Match/B and has text
  const banned = new Set([iCat,iA,iM,iB].filter(i=>i>=0));
  let iDesc = -1;
  const ths=[...table.querySelector('thead tr').children];
  for (let i=0;i<ths.length;i++){
    if (banned.has(i)) continue;
    let hasText = 0;
    for (const tr of bodyRows){
      const cell = tr.children[i];
      if (cell && cell.textContent.trim()) { hasText++; if (hasText>=Math.ceil(bodyRows.length*0.1)) break; }
    }
    if (hasText){ iDesc=i; break; }
  }
  // If no Category header, treat leftmost as Category
  if (iCat < 0) iCat = 0;

  // Merge description -> Category, then drop the desc column
  if (iDesc >= 0 && iDesc !== iCat){
    // Remove desc header
    table.querySelector('thead tr').children[iDesc]?.remove();
    // Merge each row's desc into category cell, then remove desc cell
    bodyRows.forEach(tr=>{
      const cells = tr.children;
      const catCell  = cells[iCat];
      const descCell = cells[iDesc]; // still valid because we haven't touched body yet
      if (catCell && descCell){
        const d = descCell.textContent.trim();
        if (d){
          if (!catCell.textContent.trim()) catCell.textContent = d;
          else catCell.textContent = (catCell.textContent + ' — ' + d).replace(/\s+/g,' ');
        }
        descCell.remove();
      }
    });
  }

  // Ensure we now have 4 columns max (Cat, A, Match, B). If more, drop any extras at the end.
  function colCount(){ return table.querySelector('thead tr').children.length; }
  while (colCount() > 4) {
    const last = colCount()-1;
    table.querySelector('thead tr').children[last].remove();
    bodyRows.forEach(tr => tr.children[last] && tr.children[last].remove());
  }

  // Alignments (CSS also enforces via nth-child; we set inline as belt & suspenders)
  const setAlign = (n, align, wrap) => {
    table.querySelectorAll(`thead tr > *:nth-child(${n}), tbody tr > *:nth-child(${n})`)
      .forEach(el=>{ el.style.textAlign=align; el.style.whiteSpace=wrap; });
  };
  setAlign(1,'left','normal');   // Category
  setAlign(2,'center','nowrap'); // Partner A
  setAlign(3,'center','nowrap'); // Match
  setAlign(4,'center','nowrap'); // Partner B
}

/* ====== 3) Helper: run fix on ALL tables in the CLONE ====== */
function fixPdfTables(root){
  const tables = root.querySelectorAll('table');
  console.log('[pdf-fix] tables found:', tables.length);
  tables.forEach(fixOneTable);
}

/* ====== Shorten labels across all PDF tables ====== */
const SHORT_LABEL_MAP = {
  // --- Appearance Play (examples) ---
  "Choosing my partner's outfit for the day or a scene": "Partner outfit choice",
  "Selecting their underwear, lingerie, or base layers": "Underwear selection",
  "Styling their hair (braiding, brushing, tying, etc.)": "Hair styling",
  "Picking head coverings (bonnets, veils, hoods, hats) for mood or protocol": "Headwear choice",
  "Offering makeup, polish, or accessories as part of ritual or play": "Makeup/accessories",
  "Creating themed looks (slutty, innocent, doll-like, sharp, etc.)": "Themed looks",
  "Dressing them in role-specific costumes (maid, bunny, doll, etc.)": "Role costumes",
  "Curating time-period or historical outfits (e.g., Victorian, 50s)": "Historical outfits",
  "Helping them present more femme, masc, or androgynous by request": "Gender styling",
  "Coordinating their look with mine for public or private scenes": "Coordinated looks",
  "Implementing a \"dress ritual\" or aesthetic preparation": "Dress ritual",
  "Enforcing a visual protocol (e.g., no bra, heels required, tied hair)": "Visual protocol",
  "Having my outfit selected for me by a partner": "Outfit picked for me",
  "Wearing the underwear or lingerie they choose": "Chosen lingerie",
  "Having my hair brushed, braided, tied, or styled for them": "Hair grooming",
  "Putting on a head covering (e.g., bonnet, veil, hood) they chose": "Chosen headwear"
  // --- Add mappings for other sections as desired ---
};

const STOPWORDS = new Set([
  "a","an","the","and","or","for","to","of","by","on","in","as","with","their","my","our","his","her","its",
  "at","from","into","over","under","than","that","this","those","these","etc","e.g.","eg"
]);

const REPLACEMENTS = [
  [/role[-\s]?specific/gi, "role"],
  [/time[-\s]?period/gi, "era"],
  [/historical/gi, "historic"],
  [/outfits?/gi, "outfits"],
  [/costumes?/gi, "costumes"],
  [/head\s*cover(ing|ings)/gi, "headwear"],
  [/underwear|lingerie/gi, "lingerie"],
  [/preparation/gi, "prep"],
  [/protocol/gi, "protocol"],
  [/presentation/gi, "look"],
  [/accessories?/gi, "accessories"],
];

function stripParentheticals(txt){
  return txt.replace(/\([^)]*\)/g, " ").replace(/\[[^\]]*\]/g, " ").replace(/\s+/g, " ").trim();
}

function compressWords(txt, targetChars=28, maxWords=4){
  let s = stripParentheticals(txt);
  REPLACEMENTS.forEach(([re, sub]) => { s = s.replace(re, sub); });

  const words = s.split(/\s+/).filter(Boolean);
  const kept = [];
  for (const w of words){
    const lw = w.toLowerCase();
    if (STOPWORDS.has(lw)) continue;
    kept.push(w);
    if (kept.length >= maxWords) break;
  }
  if (kept.length === 0) kept.push(words.slice(0,2).join(" "));

  let out = kept.join(" ");
  if (out.length > targetChars){
    out = out.slice(0, targetChars - 1).replace(/\s+\S*$/, "");
  }
  return out.length < s.length ? `${out}…` : out;
}

function shortenSurveyLabels(root, {
  targetChars = 28,
  maxWords = 4,
  onlyFirstColumn = true
} = {}){
  root.querySelectorAll("table").forEach(table => {
    const head = table.querySelector("thead tr");
    const rows = table.querySelectorAll("tbody tr");
    if (!head || !rows.length) return;

    let labelIdx = 0;
    if (!onlyFirstColumn){
      const headers = Array.from(head.children).map(th => (th.textContent||"").trim().toLowerCase());
      let guess = headers.findIndex(h => /^(description|item|activity|kink|category)$/i.test(h));
      if (guess === -1) guess = 0;
      labelIdx = guess;
    }

    rows.forEach(tr => {
      const cells = tr.children;
      const td = cells[labelIdx];
      if (!td) return;

      const full = (td.textContent || "").trim();
      if (!full) return;

      if (full.length <= 18) return;

      if (SHORT_LABEL_MAP[full]) {
        td.textContent = SHORT_LABEL_MAP[full];
        return;
      }

      td.textContent = compressWords(full, targetChars, maxWords);
    });
  });
}

(function injectShortLabelCSS(){
  if (document.querySelector('style[data-pdf-shortlabels]')) return;
  const css = `
    .pdf-export table{ table-layout:fixed; width:100%; }
    .pdf-export tr > *:first-child{
      text-align:left !important;
      white-space:normal !important;
      word-break:break-word !important;
      hyphens:auto !important;
    }
    .pdf-export tr > *:nth-child(n+2){
      text-align:center !important;
      white-space:nowrap !important;
    }
  `;
  const s = document.createElement('style');
  s.setAttribute('data-pdf-shortlabels','true');
  s.textContent = css;
  document.head.appendChild(s);
})();

/* ---------- build the clone (PDF-only) ---------- */
function makeClone(){
  const src=document.getElementById('pdf-container');
  if(!src) throw new Error('#pdf-container not found');

  // shell + clone
  const shell=document.createElement('div');
  Object.assign(shell.style,{background:'#000',color:'#fff',margin:'0',padding:'0',width:'100%',minHeight:'100vh',overflow:'auto'});
  const clone=src.cloneNode(true);
  clone.classList.add('pdf-export');

  // your usual cleanup
  clone.querySelectorAll('[data-hide-in-pdf], .download-btn, .print-btn, nav, header, footer').forEach(e=>e.remove());
  stripHeaderEmoji(clone); stripProblemImages(clone); forceTableDisplay(clone);

  // >>>>> THIS IS THE CRITICAL LINE <<<<<
  fixPdfTables(clone);
  shortenSurveyLabels(clone, { targetChars: 28, maxWords: 4, onlyFirstColumn: true });
  console.log('[pdf-fix] applied');

  shell.appendChild(clone);
  document.body.appendChild(shell);
  return { shell, clone };
}

/* ---------- sizing/tiling + render ---------- */
function measure(el){
  const r=el.getBoundingClientRect();
  const width = Math.ceil(Math.max(el.scrollWidth, r.width, document.documentElement.clientWidth));
  const height= Math.ceil(Math.max(el.scrollHeight, r.height));
  if (width===0 || height===0) throw new Error('Zero-size clone');
  return { width, height };
}
function plan(width,height){
  const MAX_MP=18, defaultScale=2; let scale=defaultScale;
  let mp=(width*height*scale*scale)/1e6; if(mp>MAX_MP) scale=Math.max(1,Math.sqrt((MAX_MP*1e6)/(width*height)));
  const targetSlicePx=2400, renderedH=height*scale, slices=Math.ceil(renderedH/targetSlicePx);
  return { scale, slices, targetSlicePx };
}
async function renderTile(root,width,sliceCssHeight,yOffset,scale){
  return await html2canvas(root,{backgroundColor:'#000',scale,useCORS:true,allowTaint:true,scrollX:0,scrollY:0,windowWidth:width,windowHeight:sliceCssHeight,height:sliceCssHeight,y:yOffset});
}

/* ---------- main ---------- */
export async function downloadCompatibilityPDF(){
  const jsPDFCtor = assertLibsOrThrow();
  try{
    const container=document.getElementById('pdf-container'); if(!container) throw new Error('#pdf-container not found');
    await waitUntilReady(container);

    const { shell, clone } = makeClone();
    await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));

    const { width, height } = measure(clone);
    const { scale, slices, targetSlicePx } = plan(width, height);

    const pdf = new jsPDFCtor({ unit:'pt', format:'letter', orientation: PDF_ORIENTATION });
    const pageW = pdf.internal.pageSize.getWidth();

    if (slices <= 1){
      const canvas = await renderTile(clone, width, height, 0, scale);
      const img = canvas.toDataURL('image/jpeg', 0.92);
      const ratio = canvas.height / canvas.width;
      pdf.addImage(img, 'JPEG', 0, 0, pageW, pageW*ratio, undefined, 'FAST');
    } else {
      const cssSliceH = Math.ceil(targetSlicePx/scale);
      let y=0;
      for (let i=0;i<slices;i++){
        const remaining=height-y, sliceH=Math.min(cssSliceH, remaining);
        const canvas=await renderTile(clone, width, sliceH, y, scale);
        const img=canvas.toDataURL('image/jpeg', 0.9);
        const ratio=canvas.height/canvas.width;
        if (i>0) pdf.addPage();
        pdf.addImage(img, 'JPEG', 0, 0, pageW, pageW*ratio, undefined, 'FAST');
        y+=sliceH;
      }
    }
    pdf.save('kink-compatibility.pdf');
    if (!PDF_DEBUG_SHOW_CLONE) document.body.removeChild(shell);
  }catch(err){
    console.error('[pdf] ERROR:', err);
    alert('Could not generate PDF.\n' + (err?.message || err) + '\nSee console for details.');
  }
}

/* aliases + global */
export const exportToPDF=downloadCompatibilityPDF;
export const exportCompatPDF=downloadCompatibilityPDF;
export const exportKinkCompatibilityPDF=downloadCompatibilityPDF;
export const generateCompatibilityPDF=downloadCompatibilityPDF;
if (typeof window !== 'undefined') window.downloadCompatibilityPDF = downloadCompatibilityPDF;
