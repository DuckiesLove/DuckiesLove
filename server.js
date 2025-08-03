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
      const [k, v] = part.trim().split('=');
      if (k) cookies[k] = decodeURIComponent(v || '');
    });
  }
  req.cookies = cookies;
  if (next) next();
}
app.use(cookieParser);

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
  const exemptPaths = ['/submit-token', '/token.html', '/admin', '/debug'];
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
      res.end(data);
    })
    .catch(() => {
      res.statusCode = 404;
      res.end();
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

export { app, server, cleanup };
