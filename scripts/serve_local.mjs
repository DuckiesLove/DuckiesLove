import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const PORT = parseInt(process.env.PORT || "8080", 10);
const ROOT = process.cwd();
const MIME = { ".html":"text/html",".css":"text/css",".js":"application/javascript",".json":"application/json",".png":"image/png",".svg":"image/svg+xml",".ico":"image/x-icon",".txt":"text/plain" };

const srv = http.createServer((req,res)=>{
  try{
    let p = decodeURI(req.url.split("?")[0]);
    if (p.endsWith("/")) p += "index.html";
    const file = path.join(ROOT, p);
    if (!file.startsWith(path.resolve(ROOT))) { res.writeHead(403); return res.end("Forbidden"); }
    if (!fs.existsSync(file)) { res.writeHead(404); return res.end("Not found: "+p); }
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, {"Content-Type": MIME[ext] || "application/octet-stream"});
    fs.createReadStream(file).pipe(res);
  }catch(e){ res.writeHead(500); res.end("Server error"); }
});

srv.listen(PORT, "127.0.0.1", async () => {
  const url = `http://127.0.0.1:${PORT}/tests/offline-kinks-test.html`;
  console.log(`Local server ready → ${url}`);
  try {
    const { spawn } = await import("node:child_process");
    const cmd = process.platform === "win32" ? ["cmd","/c","start","",url]
              : process.platform === "darwin" ? ["open",url]
              : ["xdg-open",url];
    spawn(cmd[0], cmd.slice(1), { stdio:"ignore", detached:true }).unref();
  } catch {}
});
