import express from 'express';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import https from 'https';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = Number.isNaN(parseInt(process.env.PORT, 10))
  ? 3000
  : parseInt(process.env.PORT, 10);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN;
const NODE_ENV = process.env.NODE_ENV || 'development';
const TOKEN_PAGE = path.join(__dirname, 'token.html');

// In-memory stores
const tokenStore = new Map();
const sessionStore = new Map();
const submitTokenAttempts = new Map();

// Clear any existing sessions on boot
sessionStore.clear();
console.log('Session store cleared on boot to enforce fresh logins');

// Session timing
const SESSION_IDLE_TIMEOUT =
  parseInt(process.env.SESSION_IDLE_TIMEOUT, 10) || 10 * 60 * 1000;
const SESSION_MAX_LIFETIME =
  parseInt(process.env.SESSION_MAX_LIFETIME, 10) || 6 * 60 * 60 * 1000;
const TOKEN_EXPIRATION_MS =
  parseInt(process.env.TOKEN_EXPIRATION_MS, 10) || 10 * 60 * 1000;

// Utils
function generateToken() {
  return crypto.randomBytes(24).toString('hex');
}
function generateSessionId() {
  return crypto.randomBytes(24).toString('hex');
}
function getIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const ip = forwarded.split(',')[0].trim();
    if (ip) return ip;
  }
  const raw = req.socket.remoteAddress;
  return raw === '::1' ? '127.0.0.1' : raw?.replace(/^::ffff:/, '');
}

function json(res, status, obj) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(obj));
}

// Simple rate limiter for /submit-token
function submitTokenRateLimiter(req, res, next) {
  const ip = getIp(req);
  const now = Date.now();
  const windowMs = 60 * 1000;
  const limit = 5;
  let record = submitTokenAttempts.get(ip);
  if (!record || now > record.reset) {
    record = { count: 1, reset: now + windowMs };
    submitTokenAttempts.set(ip, record);
    next();
    return;
  }
  if (record.count >= limit) {
    res.setHeader('Retry-After', Math.ceil((record.reset - now) / 1000));
    json(res, 429, { error: 'Too many requests' });
    return;
  }
  record.count += 1;
  next();
}

// Middleware: parse cookies
function cookieParser(req, _res, next) {
  const header = req.headers?.cookie;
  const cookies = {};
  if (header) {
    header.split(';').forEach(part => {
      const [k, ...v] = part.trim().split('=');
      if (k) cookies[k] = decodeURIComponent(v.join('=') || '');
    });
  }
  req.cookies = cookies;
  if (next) next();
}
app.use(cookieParser);

const STATIC_CACHE_CONTROL = 'no-store';
const STATIC_MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain; charset=utf-8',
};

function registerStaticDir(mountPath, dirName, { index } = {}) {
  const resolvedDir = path.join(__dirname, dirName);
  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      next();
      return;
    }

    const { pathname } = new URL(req.url, 'http://localhost');
    if (!pathname.startsWith(mountPath)) {
      next();
      return;
    }

    let relativePath = pathname.slice(mountPath.length);
    if (relativePath.startsWith('/')) relativePath = relativePath.slice(1);

    if (!relativePath || relativePath.endsWith('/')) {
      if (index) {
        relativePath = path.posix.join(relativePath || '', index);
      } else if (!relativePath) {
        next();
        return;
      }
    }

    const normalized = path.normalize(relativePath).replace(/^([\\/]*\.{2})+/g, '');
    const targetPath = path.join(resolvedDir, normalized);
    if (!targetPath.startsWith(resolvedDir)) {
      next();
      return;
    }

    fs.stat(targetPath, (statErr, stat) => {
      if (statErr) {
        if (statErr.code === 'ENOENT') {
          next();
        } else {
          console.error(`[static] Failed stat for ${targetPath}:`, statErr);
          res.statusCode = 500;
          res.end();
        }
        return;
      }

      if (!stat.isFile()) {
        next();
        return;
      }

      const ext = path.extname(targetPath).toLowerCase();
      res.setHeader('Cache-Control', STATIC_CACHE_CONTROL);
      res.setHeader('Content-Type', STATIC_MIME_TYPES[ext] || 'application/octet-stream');
      res.setHeader('Content-Length', stat.size);

      if (req.method === 'HEAD') {
        res.statusCode = 200;
        res.end();
        return;
      }

      const stream = fs.createReadStream(targetPath);
      stream.on('error', err => {
        console.error(`[static] Failed to read ${targetPath}:`, err);
        if (!res.headersSent) {
          res.statusCode = 500;
          res.end();
        } else {
          res.destroy(err);
        }
      });
      res.statusCode = 200;
      stream.pipe(res);
    });
  });
}

registerStaticDir('/css', 'css');
registerStaticDir('/js', 'js');
registerStaticDir('/src', 'src');
registerStaticDir('/data', 'data');
registerStaticDir('/kinks', 'kinks', { index: 'index.html' });

app.use(servePublicHtml);

// Route: admin generate token
app.use((req, res, next) => {
  if (req.method === 'POST' && req.url === '/admin/generate-token') {
    const ip = getIp(req);
    const token = generateToken();
    const now = Date.now();
    const ttl = TOKEN_EXPIRATION_MS;
    tokenStore.set(token, { ip, createdAt: now, ttl, used: false });
    json(res, 200, { token, expiresAt: now + ttl });
    console.log(`[${new Date().toISOString()}] Token ${token} created for IP ${ip}`);
  } else {
    next();
  }
});

// Route: submit token with rate limiting
app.use((req, res, next) => {
  if (req.method === 'POST' && req.url === '/submit-token') {
    submitTokenRateLimiter(req, res, () => {
      let body = '';
      req.on('data', chunk => {
        body += chunk;
      });
      req.on('end', () => {
        let token;
        try {
          ({ token } = JSON.parse(body || '{}'));
        } catch {
          json(res, 400, { error: 'Invalid request' });
          return;
        }
        const clientIp = getIp(req);
        const record = tokenStore.get(token);
        if (!record) {
          json(res, 401, { error: 'Invalid token' });
          return;
        }
        if (record.used) {
          json(res, 403, { error: 'Token already used' });
          return;
        }
        const now = Date.now();
        if (now > record.createdAt + record.ttl) {
          json(res, 403, { error: 'Token expired' });
          return;
        }
        if (record.ip !== clientIp) {
          json(res, 403, { error: 'IP mismatch' });
          return;
        }
        record.used = true;
        const sessionId = generateSessionId();
        sessionStore.set(sessionId, {
          originalIp: clientIp,
          currentIp: clientIp,
          ipChangeAllowed: true,
          expiresAt: now + SESSION_IDLE_TIMEOUT,
          maxExpiresAt: now + SESSION_MAX_LIFETIME,
        });
        res.setHeader(
          'Set-Cookie',
          `session_id=${sessionId}; HttpOnly; Secure; SameSite=Strict; Max-Age=${Math.floor(
            SESSION_IDLE_TIMEOUT / 1000
          )}${COOKIE_DOMAIN ? `; Domain=${COOKIE_DOMAIN}` : ''}`
        );
        json(res, 200, { success: true });
        console.log(
          `[${new Date().toISOString()}] Session ${sessionId} created for IP ${clientIp}`
        );
      });
    });
  } else {
    next();
  }
});

// Serve token submission page
app.use((req, res, next) => {
  if (req.method === 'GET' && req.url === '/token.html') {
    sendFile(res, path.join(__dirname, 'token.html'));
  } else {
    next();
  }
});

// Serve kink survey and data without auth
app.use((req, res, next) => {
  if (
    req.method === 'GET' &&
    (req.url === '/kinks/' || req.url === '/kinks' || req.url === '/kinks/index.html')
  ) {
    sendFile(res, path.join(__dirname, 'kinks', 'index.html'));
    return;
  }
  if (req.method === 'GET' && (req.url === '/data/kinks.json' || req.url === '/kinks.json')) {
    readFile(path.join(__dirname, 'data', 'kinks.json'))
      .then(data => {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(data);
      })
      .catch(() => {
        res.statusCode = 404;
        res.end();
      });
    return;
  }
  next();
});

// Route: logout
app.use((req, res, next) => {
  if (req.method === 'POST' && req.url === '/logout') {
    const sessionId = req.cookies.session_id;
    if (sessionId && sessionStore.has(sessionId)) {
      const { currentIp } = sessionStore.get(sessionId);
      sessionStore.delete(sessionId);
      console.log(
        `[${new Date().toISOString()}] Session ${sessionId} for IP ${currentIp} logged out`
      );
    }
    res.setHeader(
      'Set-Cookie',
      `session_id=; HttpOnly; Secure; SameSite=Strict; Max-Age=0${
        COOKIE_DOMAIN ? '; Domain=' + COOKIE_DOMAIN : ''
      }`
    );
    json(res, 200, { success: true });
  } else {
    next();
  }
});

// Admin route to flush all sessions
app.use((req, res, next) => {
  if (req.method === 'POST' && req.url === '/admin/flush-sessions') {
    if (req.headers['x-debug-secret'] !== process.env.DEBUG_SECRET) {
      json(res, 403, { error: 'Forbidden' });
      return;
    }
    sessionStore.clear();
    console.log(`[${new Date().toISOString()}] All sessions flushed`);
    json(res, 200, { success: true });
  } else {
    next();
  }
});

// Debug routes
app.use((req, res, next) => {
  if (
    req.method === 'GET' &&
    (req.url === '/debug/sessions' || req.url === '/debug/tokens')
  ) {
    const allowed =
      NODE_ENV !== 'production' ||
      req.headers['x-debug-secret'] === process.env.DEBUG_SECRET;
    if (!allowed) {
      json(res, 403, { error: 'Forbidden' });
      return;
    }
    if (req.url === '/debug/sessions') {
      const sessions = Array.from(sessionStore.entries()).map(([id, data]) => ({
        id,
        ...data,
      }));
      json(res, 200, { sessions });
    } else {
      const tokens = Array.from(tokenStore.entries()).map(([token, data]) => ({
        token,
        ...data,
        expiresAt: data.createdAt + data.ttl,
      }));
      json(res, 200, { tokens });
    }
  } else {
    next();
  }
});

app.use((req, res, next) => {
  if (req.method === 'GET' && req.url === '/check-session') {
    const sessionId = req.cookies.session_id;
    const session = sessionStore.get(sessionId);
    const now = Date.now();
    const ip = getIp(req);
    if (
      !session ||
      session.currentIp !== ip ||
      now > session.expiresAt ||
      now > session.maxExpiresAt
    ) {
      res.statusCode = 401;
      res.end();
      return;
    }
    res.statusCode = 200;
    res.end();
  } else {
    next();
  }
});

// Validate session middleware
function validateSession(req, res, next) {
  const sessionId = req.cookies.session_id;
  const session = sessionStore.get(sessionId);
  if (!session) {
    sendFile(res, TOKEN_PAGE, 401);
    return;
  }
  const now = Date.now();
  if (now > session.maxExpiresAt) {
    sessionStore.delete(sessionId);
    console.log(
      `[${new Date().toISOString()}] Session ${sessionId} expired (max) for IP ${session.currentIp}`
    );
    sendFile(res, TOKEN_PAGE, 403);
    return;
  }
  if (now > session.expiresAt) {
    sessionStore.delete(sessionId);
    console.log(
      `[${new Date().toISOString()}] Session ${sessionId} expired (idle) for IP ${session.currentIp}`
    );
    sendFile(res, TOKEN_PAGE, 403);
    return;
  }
  const clientIp = getIp(req);
  if (clientIp !== session.currentIp) {
    if (session.ipChangeAllowed) {
      session.currentIp = clientIp;
      session.ipChangeAllowed = false;
    } else {
      sendFile(res, TOKEN_PAGE, 403);
      return;
    }
  }
  session.expiresAt = now + SESSION_IDLE_TIMEOUT;
  res.setHeader(
    'Set-Cookie',
    `session_id=${sessionId}; HttpOnly; Secure; SameSite=Strict; Max-Age=${Math.floor(
      SESSION_IDLE_TIMEOUT / 1000
    )}${COOKIE_DOMAIN ? `; Domain=${COOKIE_DOMAIN}` : ''}`
  );
  next();
}

app.use((req, res, next) => {
  const exemptPaths = [
    '/submit-token',
    '/token.html',
    '/admin',
    '/debug',
    '/check-session',
    '/favicon.ico',
    '/compatibility.html',
    '/css/',
    '/js/',
    '/src/',
    '/kinks/',
    '/data/',
    '/kinks.json',
  ];
  if (req.url === '/' || req.url === '/index.html') {
    return next();
  }
  if (exemptPaths.some(path => req.url.startsWith(path))) {
    return next();
  }
  return validateSession(req, res, next);
});

// Protected routes
app.use((req, res, next) => {
  if (req.method === 'GET' && req.url === '/protected') {
    json(res, 200, { message: 'You have access 🎉' });
  } else if (req.method === 'GET' && req.url === '/dashboard') {
    sendFile(res, path.join(__dirname, 'protected', 'dashboard.html'));
  } else {
    next();
  }
});

function sendFile(res, filePath, status = 200) {
  readFile(filePath)
    .then(data => {
      res.statusCode = status;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      if (res.req?.method === 'HEAD') {
        res.setHeader('Content-Length', data.length);
        res.end();
        return;
      }
      res.end(data);
    })
    .catch(() => {
      res.statusCode = 404;
      res.end();
    });
}

function servePublicHtml(req, res, next) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    next();
    return;
  }

  const { pathname } = new URL(req.url, 'http://localhost');
  if (pathname === '/' || pathname === '/index.html') {
    sendFile(res, path.join(__dirname, 'index.html'));
    return;
  }

  if (!pathname.endsWith('.html')) {
    next();
    return;
  }

  if (pathname === '/token.html' || pathname.startsWith('/protected/')) {
    next();
    return;
  }

  const normalized = path
    .normalize(pathname)
    .replace(/^([\\/]*\.{2})+/g, '')
    .replace(/^\\+/g, '')
    .replace(/^\/+/, '');
  const targetPath = path.join(__dirname, normalized);
  if (!targetPath.startsWith(__dirname)) {
    next();
    return;
  }

  fs.stat(targetPath, (err, stat) => {
    if (err || !stat.isFile()) {
      next();
      return;
    }
    sendFile(res, targetPath);
  });
}

// Fallback
app.use((_req, res) => {
  res.statusCode = 404;
  res.end();
});

// Cleanup expired tokens and sessions
const cleanup = setInterval(() => {
  const now = Date.now();
  for (const [token, data] of tokenStore) {
    if (data.used || data.createdAt + data.ttl < now) {
      tokenStore.delete(token);
      console.log(
        `[${new Date().toISOString()}] Token ${token} expired for IP ${data.ip}`
      );
    }
  }
  for (const [sid, data] of sessionStore) {
    if (data.expiresAt < now || data.maxExpiresAt < now) {
      sessionStore.delete(sid);
      console.log(
        `[${new Date().toISOString()}] Session ${sid} for IP ${data.currentIp} expired during cleanup`
      );
    }
  }
  for (const [ip, data] of submitTokenAttempts) {
    if (data.reset < now) submitTokenAttempts.delete(ip);
  }
}, 10 * 60 * 1000);

let server;
if (NODE_ENV !== 'production') {
  try {
    const key = fs.readFileSync(
      process.env.TLS_KEY_PATH || path.join(__dirname, 'localhost-key.pem')
    );
    const cert = fs.readFileSync(
      process.env.TLS_CERT_PATH || path.join(__dirname, 'localhost-cert.pem')
    );
    server = await new Promise(resolve => {
      const s = https.createServer({ key, cert }, app).listen(port, () =>
        resolve(s)
      );
    });
    console.log(
      `Auth server running on https://localhost:${server.address().port}`
    );
  } catch {
    console.warn('TLS certificates not found, falling back to HTTP');
    server = await new Promise(resolve => {
      const s = app.listen(port, () => resolve(s));
    });
    console.log(
      `Auth server running on http://localhost:${server.address().port}`
    );
  }
} else {
  server = await new Promise(resolve => {
    const s = app.listen(port, () => resolve(s));
  });
  console.log(
    `Auth server running on http://localhost:${server.address().port}`
  );
}

export { app, server, cleanup, tokenStore, sessionStore, cookieParser };
