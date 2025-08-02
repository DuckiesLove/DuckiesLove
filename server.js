import express from 'express';
import crypto from 'crypto';

const app = express();
const port = process.env.PORT || 3000;

// In-memory stores
const tokenStore = new Map();
const sessionStore = new Map();

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

// Route: submit token
app.use((req, res, next) => {
  if (req.method === 'POST' && req.url === '/submit-token') {
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
      const sessionExpiry = Date.now() + 60 * 60 * 1000;
      sessionStore.set(sessionId, { ip: clientIp, expiresAt: sessionExpiry });
      res.setHeader(
        'Set-Cookie',
        `session_id=${sessionId}; HttpOnly; Secure; SameSite=Strict; Max-Age=3600`
      );
      json(res, 200, { success: true });
    });
  } else {
    next();
  }
});

// Validate session
function validateSession(req) {
  const sessionId = req.cookies.session_id;
  const session = sessionStore.get(sessionId);
  if (!session) return { ok: false, status: 401, error: 'No session' };
  if (Date.now() > session.expiresAt) {
    sessionStore.delete(sessionId);
    return { ok: false, status: 403, error: 'Session expired' };
  }
  if (session.ip !== getIp(req)) return { ok: false, status: 403, error: 'IP mismatch' };
  return { ok: true };
}

// Protected route
app.use((req, res, next) => {
  if (req.method === 'GET' && req.url === '/protected') {
    const check = validateSession(req);
    if (!check.ok) {
      json(res, check.status, { error: check.error });
      return;
    }
    json(res, 200, { message: 'You have access 🎉' });
  } else {
    next();
  }
});

// Fallback
app.use((_req, res) => {
  res.statusCode = 404;
  res.end();
});

// Cleanup expired tokens and sessions
setInterval(() => {
  const now = Date.now();
  for (const [token, data] of tokenStore) {
    if (data.used || data.expiresAt < now) tokenStore.delete(token);
  }
  for (const [sid, data] of sessionStore) {
    if (data.expiresAt < now) sessionStore.delete(sid);
  }
}, 10 * 60 * 1000);

const server = app.listen(port, () => {
  console.log(`Auth server running on http://localhost:${port}`);
});

export { app, server };
