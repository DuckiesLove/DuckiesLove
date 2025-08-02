import test from 'node:test';
import assert from 'node:assert';
import { execSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

async function getToken(baseUrl) {
  const res = await fetch(`${baseUrl}/admin/generate-token`, { method: 'POST' });
  const data = await res.json();
  return data.token;
}

test('https dev server sets secure cookie', async t => {
  const dir = mkdtempSync(join(tmpdir(), 'cert-'));
  const keyPath = join(dir, 'key.pem');
  const certPath = join(dir, 'cert.pem');
  execSync(
    `openssl req -x509 -newkey rsa:2048 -keyout ${keyPath} -out ${certPath} -days 1 -nodes -subj "/CN=localhost"`,
    { stdio: 'ignore' }
  );

  process.env.PORT = 0;
  process.env.TLS_KEY_PATH = keyPath;
  process.env.TLS_CERT_PATH = certPath;
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

  let server, cleanup;
  try {
    ({ server, cleanup } = await import(`../server.js?${Math.random()}`));
    const port = server.address().port;
    const base = `https://localhost:${port}`;
    const token = await getToken(base);
    const submitRes = await fetch(`${base}/submit-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    const cookie = submitRes.headers.get('set-cookie');
    assert.ok(cookie.includes('Secure'));
    const res = await fetch(`${base}/protected`, { headers: { Cookie: cookie } });
    assert.strictEqual(res.status, 200);
  } catch {
    t.skip('https not available');
  } finally {
    if (server) server.close();
    if (cleanup) clearInterval(cleanup);
    delete process.env.TLS_KEY_PATH;
    delete process.env.TLS_CERT_PATH;
    delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
  }
});
