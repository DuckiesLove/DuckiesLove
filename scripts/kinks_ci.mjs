import http from "node:http";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

function log(...a){ console.log("[CI]", ...a); }

async function head(u){
  try { const r = await fetch(u,{method:"HEAD"}); return {ok:r.ok, status:r.status}; }
  catch { return {ok:false, status:"FAIL"}; }
}

async function liveOK(){
  const { ok, status } = await head("https://talkkink.org/kinks/");
  log("live probe:", status);
  return ok && status===200;
}

// Minimal static server (no deps)
function serve(dir, port=8080){
  const mimes = { ".html":"text/html",".css":"text/css",".js":"application/javascript",".json":"application/json",".png":"image/png",".svg":"image/svg+xml",".ico":"image/x-icon" };
  const srv = http.createServer((req,res)=>{
    try{
      let p = decodeURI(req.url.split("?")[0]);
      if (p.endsWith("/")) p += "index.html";
      const file = path.join(dir, p);
      if (!file.startsWith(path.resolve(dir))) { res.writeHead(403); return res.end("Forbidden"); }
      if (!fs.existsSync(file)) { res.writeHead(404); return res.end("Not found"); }
      const ext = path.extname(file).toLowerCase();
      res.writeHead(200, {"Content-Type": mimes[ext] || "application/octet-stream"});
      fs.createReadStream(file).pipe(res);
    }catch(e){ res.writeHead(500); res.end("Server error"); }
  });
  return new Promise(resolve => srv.listen(port, "127.0.0.1", ()=>resolve(srv)));
}

async function main(){
  let base = "https://talkkink.org/kinks/";
  let srv = null;

  if (!(await liveOK())) {
    // fallback to local
    const root = fs.existsSync("docs/kinks/index.html") ? "docs" :
                 fs.existsSync("kinks/index.html")      ? "."   : null;
    if (!root) { console.error("Cannot find kinks/index.html in docs/ or repo root."); process.exit(2); }
    srv = await serve(root, 8080);
    base = "http://127.0.0.1:8080/kinks/";
    log("serving local:", path.resolve(root), "→", base);
  } else {
    log("using live:", base);
  }

  // run E2E against the chosen base
  const env = { ...process.env, KINKS_BASE: base };
  const p = spawn(process.execPath, ["scripts/kinks_e2e.mjs"], { stdio:"inherit", env });
  const code = await new Promise(res => p.on("close", res));

  if (srv) srv.close();
  process.exit(code);
}
main();
