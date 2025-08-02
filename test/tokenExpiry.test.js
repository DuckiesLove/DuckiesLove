import test from 'node:test';
import assert from 'node:assert';

async function getToken(baseUrl) {
  const res = await fetch(`${baseUrl}/admin/generate-token`, { method: 'POST' });
  const data = await res.json();
  return data.token;
}

test('token expires after TTL', async t => {
  process.env.PORT = 0;
  process.env.TOKEN_EXPIRATION_MS = 50;
  const { server, cleanup } = await import(`../server.js?${Math.random()}`);
  const port = server.address().port;
  const base = `http://localhost:${port}`;
  t.after(() => {
    server.close();
    clearInterval(cleanup);
    delete process.env.TOKEN_EXPIRATION_MS;
  });
  const token = await getToken(base);
  await new Promise(r => setTimeout(r, 60));
  const res = await fetch(`${base}/submit-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  assert.strictEqual(res.status, 403);
  const body = await res.json();
  assert.strictEqual(body.error, 'Token expired');
});
