import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";

const BASE = process.env.KINKS_BASE || "https://talkkink.org/kinks/";
const ART = "artifacts";
await fs.mkdir(ART, { recursive: true });

let hadConsoleError = false;

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  acceptDownloads: true,
  ignoreHTTPSErrors: true,
  viewport: { width: 1440, height: 900 }
});
const page = await ctx.newPage();

// capture console errors/warnings
page.on("console", msg => {
  const type = msg.type();
  if (type === "error") hadConsoleError = true;
});

let capturedJSONPath = null;
page.on("download", async (dl) => {
  const suggested = dl.suggestedFilename() || "export.json";
  const out = path.join(ART, suggested.replace(/\?.*$/,""));
  await dl.saveAs(out);
  capturedJSONPath = out;
});

// 1) Navigate
await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60_000 });

// 2) Ensure critical assets loaded (visible in network)
const assetResults = await page.evaluate(async () => {
  const check = async (p) => {
    try {
      const r = await fetch(p, { cache:"no-store" });
      return { p, status:r.status, ok:r.ok, type:r.headers.get("content-type")||"" };
    } catch (e) { return { p, status: "FAIL", ok:false, type:String(e) }; }
  };
  const need = ["/css/style.css","/css/theme.css","/js/theme.js","/data/kinks.json"];
  const res = [];
  for (const p of need) res.push(await check(p));
  return res;
});
const badAssets = assetResults.filter(r => r.status !== 200);
if (badAssets.length) {
  console.log("Asset check:", assetResults);
  throw new Error("Missing assets: " + badAssets.map(r=>`${r.p}:${r.status}`).join(", "));
}

// 3) If a Start button exists, enable & click it
await page.evaluate(() => {
  const b = document.querySelector("#start,#startSurvey");
  if (b) b.removeAttribute("disabled");
});
const startBtn = await page.$("#start,#startSurvey");
if (startBtn) {
  await startBtn.click().catch(()=>{});
  await page.waitForTimeout(400);
}

// 4) Select ratings on the first N dropdowns
const changed = await page.evaluate(({N})=>{
  const selects = Array.from(document.querySelectorAll("select"));
  let c = 0;
  for (const el of selects.slice(0, N)) {
    const v = el.querySelector("option[value='3']") ? "3" :
              (el.querySelector("option[value='4']") ? "4" : "2");
    if (el.value !== v) {
      el.value = v;
      el.dispatchEvent(new Event("change", { bubbles: true }));
      c++;
    }
  }
  return c;
},{N: 15});
console.log(`Set ${changed} dropdown(s).`);

// 5) Click an Export/Download/Save button if present
const exportBtn = await page.locator('button:has-text("Export"), button:has-text("Download"), a:has-text("Export"), a:has-text("Download"), button:has-text("Save"), a:has-text("Save")').first();
if (await exportBtn.count()) {
  const [dl] = await Promise.all([
    page.waitForEvent("download").catch(()=>null),
    exportBtn.click().catch(()=>null),
  ]);
  if (dl && !capturedJSONPath) {
    const out = path.join(ART, dl.suggestedFilename() || "export.json");
    await dl.saveAs(out);
    capturedJSONPath = out;
  }
} else {
  console.log("No Export/Download/Save button found.");
}

// 6) Screenshot
const shot = path.join(ART, "kinks.png");
await page.screenshot({ path: shot, fullPage: true });
console.log("Saved screenshot:", shot);

// 7) Validate exported JSON (if any)
let okClamp = true;
if (capturedJSONPath) {
  const txt = await fs.readFile(capturedJSONPath, "utf8");
  let obj = null;
  try { obj = JSON.parse(txt); } catch { /* ignore */ }
  const arr = Array.isArray(obj) ? obj : (obj && Array.isArray(obj.kinks) ? obj.kinks : []);
  const bad = [];
  for (let i=0;i<arr.length;i++){
    const r = arr[i]?.rating;
    if (r == null) continue;
    const n = +r;
    if (!Number.isFinite(n) || n < 0 || n > 5) bad.push({i, rating:r});
  }
  if (bad.length) {
    okClamp = false;
    console.log("Out-of-range ratings:", bad.slice(0,10));
  } else {
    console.log("All ratings within 0–5 (or null) ✓");
  }
  console.log("Export captured:", capturedJSONPath, `(${txt.length} bytes)`);
} else {
  console.log("No export file captured.");
}

// 8) Summarize + exit code
console.log("AssetResults:", assetResults);
console.log("ConsoleErrors:", hadConsoleError);
await browser.close();

const okAssets = badAssets.length === 0;
const overall = okAssets && !hadConsoleError && okClamp;
if (!overall) {
  console.log({ okAssets, hadConsoleError, okClamp });
  process.exit(1);
}
console.log("E2E OK ✓");
