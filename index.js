import http from 'http';
import fs from 'fs/promises';
import bcrypt from './lib/bcrypt.js';

const TOKENS_FILE = './tokens.json';

async function loadTokens() {
  try {
    const data = await fs.readFile(TOKENS_FILE, 'utf8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function saveTokens(tokens) {
  await fs.writeFile(TOKENS_FILE, JSON.stringify(tokens, null, 2));
}

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/login') {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
    });
    req.on('end', async () => {
      try {
        const { token } = JSON.parse(body || '{}');
        if (!token) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Token required' }));
          return;
        }
        const rawIp = req.socket.remoteAddress;
        const ip = rawIp === '::1' ? '127.0.0.1' : rawIp?.replace(/^::ffff:/, '');
        const tokens = await loadTokens();
        const now = Date.now();
        let matchIndex = -1;
        for (let i = 0; i < tokens.length; i++) {
          const t = tokens[i];
          if (!t.used && t.ip === ip && t.expires > now) {
            const ok = await bcrypt.compare(token, t.hash);
            if (ok) {
              matchIndex = i;
              break;
            }
          }
        }
        if (matchIndex === -1) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid token' }));
          return;
        }
        tokens[matchIndex].used = true;
        await saveTokens(tokens);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid request' }));
      }
    });
  } else {
    res.writeHead(404);
    res.end();
  }
});

server.listen(3000, () => {
  console.log('Server running on port 3000');
});

export default server;
