import test from 'node:test';
import assert from 'node:assert';

async function getToken(baseUrl) {
  const res = await fetch(`${baseUrl}/admin/generate-token`, { method: 'POST' });
  const data = await res.json();
  return data.token;
}

test('cleanup removes expired entries', async t => {
  process.env.PORT = 0;
  process.env.SESSION_IDLE_TIMEOUT = 50;
  process.env.SESSION_MAX_LIFETIME = 1000;
  process.env.TOKEN_EXPIRATION_MS = 50;
  const { server, cleanup, tokenStore, sessionStore } = await import(
    `../server.js?${Math.random()}`
  );
  const port = server.address().port;
  const base = `http://localhost:${port}`;
  t.after(() => {
    server.close();
    clearInterval(cleanup);
    delete process.env.SESSION_IDLE_TIMEOUT;
    delete process.env.SESSION_MAX_LIFETIME;
    delete process.env.TOKEN_EXPIRATION_MS;
  });
  await fetch(`${base}/admin/generate-token`, { method: 'POST' });
  const token = await getToken(base);
  await fetch(`${base}/submit-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  await new Promise(r => setTimeout(r, 60));
  cleanup._onTimeout();
  assert.strictEqual(tokenStore.size, 0);
  assert.strictEqual(sessionStore.size, 0);
});
