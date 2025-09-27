import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = __dirname;
const PORT = process.env.PORT || 8080;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".htm":  "text/html; charset=utf-8",
  ".js":   "application/javascript; charset=utf-8",
  ".mjs":  "application/javascript; charset=utf-8",
  ".css":  "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png":  "image/png",
  ".jpg":  "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg":  "image/svg+xml",
  ".ico":  "image/x-icon",
  ".pdf":  "application/pdf",
  ".txt":  "text/plain; charset=utf-8",
};

function send(res, code, data, headers={}) {
  res.writeHead(code, {
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    ...headers
  });
  res.end(data);
}

function serveFile(res, filePath) {
  fs.readFile(filePath, (err, buf) => {
    if (err) return send(res, 404, "Not found");
    const ext = path.extname(filePath).toLowerCase();
    send(res, 200, buf, { "Content-Type": MIME[ext] || "application/octet-stream" });
  });
}

http.createServer((req, res) => {
  try {
    const reqPath = decodeURIComponent(new URL(req.url, "http://localhost").pathname);

    let relativePath = reqPath;
    if (relativePath === "/") {
      relativePath = "/index.html";
    } else if (relativePath.endsWith("/")) {
      relativePath += "index.html";
    }

    const normalized = path
      .normalize(relativePath)
      .replace(/^([\\/]*\.\.[\\/])+/, "");
    const safeRelative = normalized.startsWith(path.sep)
      ? normalized.slice(1)
      : normalized;

    let filePath = path.join(ROOT, safeRelative);

    if (reqPath === "/kinks.json") {
      filePath = path.join(ROOT, "data", "kinks.json");
    }

    // security: prevent path traversal
    if (!filePath.startsWith(ROOT)) return send(res, 403, "Forbidden");

    fs.stat(filePath, (err, stat) => {
      if (!err && stat.isFile()) return serveFile(res, filePath);
      // fallback to compatibility.html for quick testing
      const fallback = path.join(ROOT, "compatibility.html");
      if (fs.existsSync(fallback)) return serveFile(res, fallback);
      send(res, 404, "Not found");
    });
  } catch (e) {
    send(res, 500, String(e));
  }
}).listen(PORT, () => {
  console.log(`Talk Kink static server running → http://localhost:${PORT}/compatibility.html`);
});

