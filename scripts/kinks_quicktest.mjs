import http from "node:http";
import fs   from "node:fs";
import path from "node:path";
import {fileURLToPath}from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot  = path.resolve(__dirname, "..");
const fetchTimeoutMs = 8000;

function t(s){ return s.toString().padStart(3, " "); }
function ok(v){ return v ? "OK " : "FAIL"; }

async function fFetch(u, opt={}){
  const ac = new AbortController();
  const t = setTimeout(()=>ac.abort(new Error("Timeout")), opt.timeout ?? fetchTimeoutMs);
  try{
    const r = await fetch(u, {cache:"no-store", ...opt, signal:ac.signal});
    return r;
  } finally { clearTimeout(t); }
}

async function headOrGet(u){
  try {
    let r = await fFetch(u, {method:"HEAD"}).catch(()=>null);
    let ct = "";
    let body = "";
    if (r && r.ok){
      ct = r.headers.get("content-type") || "";
      if (/json|html|text/.test(ct)) {
        body = await r.text();
      }
      if (!body.trim()) {
        r = null; // force GET when HEAD yields no useful body
      }
    }
    if (!r || !r.ok){
      r = await fFetch(u).catch(()=>null);
      if (!r) return {url:u, ok:false, status:"FAIL", ct:"", note:"network error"};
      ct = r.headers.get("content-type") || "";
      if (/json|html|text/.test(ct)) { body = await r.text(); }
    }
    return {url:u, ok:r.ok, status:r.status, ct, body};
  } catch (e) {
    return {url:u, ok:false, status:"FAIL", ct:"", note:String(e)};
  }
}

function looksHTML(ct, body){
  return /text\/html/i.test(ct||"") || /^\s*<!doctype html/i.test(body||"") || /<html[\s>]/i.test(body||"");
}

function logRow(label, r){
  const s = typeof r.status==="number" ? r.status : r.status || "FAIL";
  console.log(`${label.padEnd(10)} ${t(s)}  ${r.ok?"OK ":"-- "}  ${r.url}`);
}

async function checkLive(base="https://talkkink.org"){
  const urls = [
    `${base}/kinks/`,
    `${base}/css/style.css`,
    `${base}/js/theme.js`,
    `${base}/data/kinks.json`
  ];
  console.log(`\n=== LIVE CHECK @ ${base}`);
  const out = [];
  for (const u of urls){
    const r = await headOrGet(u);
    logRow("LIVE", r);
    out.push(r);
  }
  const data = out.find(x=>x.url.endsWith("/data/kinks.json"));
  let jsonOk=false, jsonItems="unknown", htmlRewrite=false, netBlocked=false;
  if (!data || !data.ok){
    netBlocked = (String(data?.status).startsWith("FAIL") || data?.status===403);
  } else {
    if (looksHTML(data.ct, data.body)) { htmlRewrite=true; }
    else {
      try {
        const j = JSON.parse(data.body||"");
        const arr = Array.isArray(j) ? j : (j && Array.isArray(j.kinks) ? j.kinks : []);
        jsonOk = true; jsonItems = Array.isArray(arr) ? arr.length : "unknown";
      } catch { /* fallthrough */ }
    }
  }
  return { out, jsonOk, jsonItems, htmlRewrite, netBlocked };
}

function mimeOf(p){
  const ext = path.extname(p).toLowerCase();
  return ({
    ".html":"text/html; charset=utf-8",
    ".htm":"text/html; charset=utf-8",
    ".js":"application/javascript; charset=utf-8",
    ".mjs":"application/javascript; charset=utf-8",
    ".css":"text/css; charset=utf-8",
    ".json":"application/json; charset=utf-8",
    ".svg":"image/svg+xml",
    ".png":"image/png",
    ".jpg":"image/jpeg",
    ".jpeg":"image/jpeg",
    ".gif":"image/gif",
    ".webp":"image/webp",
    ".ico":"image/x-icon",
  })[ext] || "application/octet-stream";
}

function startStatic(port=8787, root=repoRoot){
  const server = http.createServer((req,res)=>{
    let urlPath = decodeURIComponent(req.url.split("?")[0]);
    if (urlPath === "/") urlPath = "/index.html";
    // ensure /kinks/ resolves to kinks/index.html
    if (urlPath.endsWith("/kinks/")) urlPath += "index.html";
    const fp = path.join(root, urlPath.replace(/^\/+/, ""));
    fs.readFile(fp, (err, buf)=>{
      if (err){
        res.statusCode = 404; res.end("Not Found: "+urlPath); return;
      }
      res.setHeader("Content-Type", mimeOf(fp));
      res.end(buf);
    });
  });
  return new Promise((resolve)=>server.listen(port, ()=>resolve(server)));
}

async function checkLocal(){
  console.log(`\n=== LOCAL CHECK @ http://127.0.0.1:8787`);
  const page = await headOrGet("http://127.0.0.1:8787/kinks/");
  logRow("LOCAL", page);
  const json = await headOrGet("http://127.0.0.1:8787/data/kinks.json");
  logRow("LOCAL", json);

  let jsonOk=false, jsonItems="unknown", htmlRewrite=false;
  if (json.ok){
    if (looksHTML(json.ct, json.body)) { htmlRewrite=true; }
    else {
      try {
        const j = JSON.parse(json.body||"");
        const arr = Array.isArray(j) ? j : (j && Array.isArray(j.kinks) ? j.kinks : []);
        jsonOk = true; jsonItems = Array.isArray(arr) ? arr.length : "unknown";
      } catch {}
    }
  }
  // Quick DOM sanity: ensure Start button & at least one category checkbox exist in source
  const hasStart   = /id=["']startSurvey|startSurveyBtn["']/.test(page.body||"");
  const hasCatBox  = /class=["']category-checkbox["']|name=["']category["']\s+type=["']checkbox["']/.test(page.body||"");

  return { pageOk: !!page.ok, hasStart, hasCatBox, jsonOk, jsonItems, htmlRewrite };
}

(async ()=>{
  const base = process.argv[2] || "https://talkkink.org";
  const live = await checkLive(base).catch(e=>({out:[], jsonOk:false, jsonItems:"unknown", htmlRewrite:false, netBlocked:true, err:e}));
  const server = await startStatic(8787).catch(()=>null);
  const local = server ? await checkLocal() : {pageOk:false, hasStart:false, hasCatBox:false, jsonOk:false, jsonItems:"unknown", htmlRewrite:false};
  if (server) server.close();

  console.log("\n=== SUMMARY");
  console.log(`LIVE data.json:  ${live.jsonOk ? "OK" : (live.htmlRewrite ? "HTML-REWRITE" : (live.netBlocked ? "NETWORK-BLOCKED" : "NOT-OK"))}  items=${live.jsonItems}`);
  console.log(`LOCAL page:      ${local.pageOk ? "OK" : "NOT-OK"}  startBtn=${local.hasStart}  catBox=${local.hasCatBox}`);
  console.log(`LOCAL data.json: ${local.jsonOk ? "OK" : (local.htmlRewrite ? "HTML-REWRITE" : "NOT-OK")}  items=${local.jsonItems}`);

  // Exit codes: prefer local failure if live blocked by proxy
  const liveHardFail = !live.jsonOk && !live.htmlRewrite && !live.netBlocked;
  const localFail    = !(local.pageOk && local.hasStart && local.hasCatBox && local.jsonOk);
  const exitCode = (localFail || liveHardFail) ? 1 : 0;

  if (exitCode){
    console.log("\nNEXT:");
    if (!local.pageOk)         console.log("- Local /kinks/ not found. Ensure kinks/index.html exists.");
    if (local.pageOk && !local.hasStart)  console.log("- Start button missing (id=startSurvey/startSurveyBtn).");
    if (local.pageOk && !local.hasCatBox) console.log("- No category checkboxes detected (.category-checkbox).");
    if (!local.jsonOk)         console.log("- Local data/kinks.json missing or invalid JSON.");
    if (live.htmlRewrite)      console.log("- LIVE is rewriting /data/kinks.json to HTML → fix host rewrites or publish the JSON file.");
    if (live.netBlocked)       console.log("- LIVE blocked by proxy/ACL; local checks passed? deploy & re-run from a network that allows outbound https.");
  } else {
    console.log("\nPASS: local is healthy; live either OK or not reachable from here.");
  }
  process.exit(exitCode);
})();
