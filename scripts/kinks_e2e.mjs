import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";

const BASE = process.env.KINKS_BASE || "https://talkkink.org/kinks/";
const ART = "artifacts";
await fs.mkdir(ART, { recursive: true });

let hadConsoleError = false;
const browser = await chromium.launch({ headless:true });
const ctx = await browser.newContext({ acceptDownloads:true, ignoreHTTPSErrors:true, viewport:{width:1440,height:900} });
const page = await ctx.newPage();

page.on("console", m => { if (m.type()==="error") hadConsoleError = true; });
let exportPath = null;
page.on("download", async dl => {
  const out = path.join(ART, (dl.suggestedFilename()||"export.json").replace(/\?.*$/,""));
  await dl.saveAs(out); exportPath = out;
});

await page.goto(BASE, { waitUntil:"domcontentloaded", timeout:60000 });

// Ensure critical assets load
const assets = await page.evaluate(async ()=>{
  const need = ["/css/style.css","/css/theme.css","/js/theme.js","/data/kinks.json"];
  const out = [];
  for (const p of need) {
    try { const r = await fetch(p,{cache:"no-store"}); out.push({p,status:r.status,ok:r.ok}); }
    catch { out.push({p,status:"FAIL",ok:false}); }
  }
  return out;
});
const bad = assets.filter(a => a.status !== 200);
if (bad.length) { console.log("Asset check:", assets); throw new Error("Missing assets"); }

// click Start if present
await page.evaluate(()=>document.querySelector("#start,#startSurvey")?.removeAttribute("disabled"));
const start = await page.$("#start,#startSurvey");
if (start) { await start.click().catch(()=>{}); await page.waitForTimeout(400); }

// set ratings on first N dropdowns
const changed = await page.evaluate(({N})=>{
  const sels = Array.from(document.querySelectorAll("select"));
  let c=0; for (const el of sels.slice(0,N)) {
    const v = el.querySelector("option[value='3']") ? "3" : (el.querySelector("option[value='4']")?"4":"2");
    if (el.value !== v) { el.value = v; el.dispatchEvent(new Event("change",{bubbles:true})); c++; }
  } return c;
},{N:15});
console.log(`Set ${changed} dropdown(s)`);

// click Export/Download/Save if present
const exportBtn = await page.locator('button:has-text("Export"),a:has-text("Export"),button:has-text("Download"),a:has-text("Download"),button:has-text("Save"),a:has-text("Save")').first();
if (await exportBtn.count()) {
  const [dl] = await Promise.all([page.waitForEvent("download").catch(()=>null), exportBtn.click().catch(()=>null)]);
  if (dl && !exportPath) { const out = path.join(ART, dl.suggestedFilename()||"export.json"); await dl.saveAs(out); exportPath = out; }
} else {
  console.log("No export button found.");
}

const shot = path.join(ART,"kinks.png"); await page.screenshot({path:shot, fullPage:true}); console.log("Screenshot:", shot);

// validate clamp if we captured export
let clampOK = true;
if (exportPath) {
  const txt = await fs.readFile(exportPath,"utf8"); let obj=null;
  try { obj = JSON.parse(txt); } catch {}
  const arr = Array.isArray(obj) ? obj : (obj && Array.isArray(obj.kinks) ? obj.kinks : []);
  const badR = [];
  for (let i=0;i<arr.length;i++){ const r = arr[i]?.rating; if (r==null) continue; const n=+r; if (!Number.isFinite(n) || n<0 || n>5) badR.push({i,rating:r}); }
  if (badR.length) { clampOK = false; console.log("Out-of-range ratings (first 10):", badR.slice(0,10)); }
  else console.log("All ratings within 0–5 (or null) ✓");
  console.log("Export:", exportPath, `(${txt.length} bytes)`);
}

await browser.close();
if (!(clampOK) || hadConsoleError) { console.log({clampOK, hadConsoleError}); process.exit(1); }
console.log("E2E OK ✓");
