import express from 'express';
import crypto from 'crypto';
import path from 'path';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';

const app = express();
const port = process.env.PORT || 3000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// In-memory stores
const tokenStore = new Map();
const sessionStore = new Map();
const submitTokenAttempts = new Map();

// Session timing
const SESSION_IDLE_TIMEOUT_MS =
  parseInt(process.env.SESSION_IDLE_TIMEOUT_MS, 10) || 10 * 60 * 1000;
const SESSION_MAX_LIFETIME_MS =
  parseInt(process.env.SESSION_MAX_LIFETIME_MS, 10) || 6 * 60 * 60 * 1000;

// Utils
function generateToken() {
  return crypto.randomBytes(24).toString('hex');
}
function generateSessionId() {
  return crypto.randomBytes(24).toString('hex');
}
function getIp(req) {
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
    const expiresAt = Date.now() + 10 * 60 * 1000;
    tokenStore.set(token, { ip, expiresAt, used: false });
    json(res, 200, { token, expiresAt });
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
        if (Date.now() > record.expiresAt) {
          json(res, 403, { error: 'Token expired' });
          return;
        }
        if (record.ip !== clientIp) {
          json(res, 403, { error: 'IP mismatch' });
          return;
        }
        record.used = true;
        const sessionId = generateSessionId();
        const now = Date.now();
        sessionStore.set(sessionId, {
          ip: clientIp,
          expiresAt: now + SESSION_IDLE_TIMEOUT_MS,
          maxExpiresAt: now + SESSION_MAX_LIFETIME_MS,
        });
        res.setHeader(
          'Set-Cookie',
          `session_id=${sessionId}; HttpOnly; Secure; SameSite=Strict; Max-Age=${Math.floor(
            SESSION_IDLE_TIMEOUT_MS / 1000
          )}`
        );
        json(res, 200, { success: true });
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
      sessionStore.delete(sessionId);
      console.log(`Session ${sessionId} logged out`);
    }
    res.setHeader(
      'Set-Cookie',
      'session_id=; HttpOnly; Secure; SameSite=Strict; Max-Age=0'
    );
    json(res, 200, { success: true });
  } else {
    next();
  }
});

// Validate session middleware
function validateSession(req, res, next) {
  const sessionId = req.cookies.session_id;
  const session = sessionStore.get(sessionId);
  if (!session) {
    json(res, 401, { error: 'No session' });
    return;
  }
  const now = Date.now();
  if (now > session.maxExpiresAt) {
    sessionStore.delete(sessionId);
    console.log(`Session ${sessionId} expired (max)`);
    json(res, 403, { error: 'Session expired' });
    return;
  }
  if (now > session.expiresAt) {
    sessionStore.delete(sessionId);
    console.log(`Session ${sessionId} expired (idle)`);
    json(res, 403, { error: 'Session expired' });
    return;
  }
  if (session.ip !== getIp(req)) {
    json(res, 403, { error: 'IP mismatch' });
    return;
  }
  session.expiresAt = now + SESSION_IDLE_TIMEOUT_MS;
  res.setHeader(
    'Set-Cookie',
    `session_id=${sessionId}; HttpOnly; Secure; SameSite=Strict; Max-Age=${Math.floor(
      SESSION_IDLE_TIMEOUT_MS / 1000
    )}`
  );
  next();
}

// Protected routes
app.use((req, res, next) => {
  if (req.method === 'GET' && req.url === '/protected') {
    validateSession(req, res, () => {
      json(res, 200, { message: 'You have access 🎉' });
    });
  } else if (req.method === 'GET' && req.url === '/dashboard') {
    validateSession(req, res, () => {
      sendFile(res, path.join(__dirname, 'protected', 'dashboard.html'));
    });
  } else {
    next();
  }
});

function sendFile(res, filePath) {
  readFile(filePath)
    .then(data => {
      res.statusCode = 200;
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
    if (data.used || data.expiresAt < now) tokenStore.delete(token);
  }
  for (const [sid, data] of sessionStore) {
    if (data.expiresAt < now || data.maxExpiresAt < now) {
      sessionStore.delete(sid);
      console.log(`Session ${sid} expired during cleanup`);
    }
  }
  for (const [ip, data] of submitTokenAttempts) {
    if (data.reset < now) submitTokenAttempts.delete(ip);
  }
}, 10 * 60 * 1000);

const server = app.listen(port, () => {
  console.log(`Auth server running on http://localhost:${port}`);
});

export { app, server, cleanup };
