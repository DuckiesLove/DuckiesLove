import test from 'node:test';
import assert from 'node:assert';

async function getToken(baseUrl, headers = {}) {
  const res = await fetch(`${baseUrl}/admin/generate-token`, { method: 'POST', headers });
  const data = await res.json();
  return data.token;
}

function getCookie(res) {
  return res.headers.get('set-cookie');
}

test('session controls', async t => {
  await t.test('logout clears session', async () => {
    process.env.PORT = 0;
    process.env.SESSION_IDLE_TIMEOUT = 1000;
    process.env.SESSION_MAX_LIFETIME = 5000;
    const { server, cleanup } = await import(`../server.js?${Math.random()}`);
    const port = server.address().port;
    const base = `http://localhost:${port}`;
    t.after(() => {
      server.close();
      clearInterval(cleanup);
      delete process.env.SESSION_IDLE_TIMEOUT;
      delete process.env.SESSION_MAX_LIFETIME;
    });
    const token = await getToken(base);
    const submitRes = await fetch(`${base}/submit-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    const cookie = getCookie(submitRes);
    const okRes = await fetch(`${base}/protected`, { headers: { Cookie: cookie } });
    assert.strictEqual(okRes.status, 200);
    const logoutRes = await fetch(`${base}/logout`, {
      method: 'POST',
      headers: { Cookie: cookie },
    });
    assert.strictEqual(logoutRes.status, 200);
    const afterRes = await fetch(`${base}/protected`, {
      headers: { Cookie: cookie },
    });
    assert.strictEqual(afterRes.status, 401);
  });

  await t.test('session expires after idle timeout', async () => {
    process.env.PORT = 0;
    process.env.SESSION_IDLE_TIMEOUT = 100;
    process.env.SESSION_MAX_LIFETIME = 1000;
    const { server, cleanup } = await import(`../server.js?${Math.random()}`);
    const port = server.address().port;
    const base = `http://localhost:${port}`;
    t.after(() => {
      server.close();
      clearInterval(cleanup);
      delete process.env.SESSION_IDLE_TIMEOUT;
      delete process.env.SESSION_MAX_LIFETIME;
    });
    const token = await getToken(base);
    const submitRes = await fetch(`${base}/submit-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    const cookie = getCookie(submitRes);
    const okRes = await fetch(`${base}/protected`, { headers: { Cookie: cookie } });
    assert.strictEqual(okRes.status, 200);
    await new Promise(r => setTimeout(r, 150));
    const expiredRes = await fetch(`${base}/protected`, {
      headers: { Cookie: cookie },
    });
    assert.strictEqual(expiredRes.status, 403);
  });

  await t.test('session expires after max lifetime', async () => {
    process.env.PORT = 0;
    process.env.SESSION_IDLE_TIMEOUT = 1000;
    process.env.SESSION_MAX_LIFETIME = 200;
    const { server, cleanup } = await import(`../server.js?${Math.random()}`);
    const port = server.address().port;
    const base = `http://localhost:${port}`;
    t.after(() => {
      server.close();
      clearInterval(cleanup);
      delete process.env.SESSION_IDLE_TIMEOUT;
      delete process.env.SESSION_MAX_LIFETIME;
    });
    const token = await getToken(base);
    const submitRes = await fetch(`${base}/submit-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    const cookie = getCookie(submitRes);
    const okRes = await fetch(`${base}/protected`, { headers: { Cookie: cookie } });
    assert.strictEqual(okRes.status, 200);
    await new Promise(r => setTimeout(r, 250));
    const expiredRes = await fetch(`${base}/protected`, {
      headers: { Cookie: cookie },
    });
    assert.strictEqual(expiredRes.status, 403);
  });

  await t.test('session refreshes on activity', async () => {
    process.env.PORT = 0;
    process.env.SESSION_IDLE_TIMEOUT = 100;
    process.env.SESSION_MAX_LIFETIME = 1000;
    const { server, cleanup } = await import(`../server.js?${Math.random()}`);
    const port = server.address().port;
    const base = `http://localhost:${port}`;
    t.after(() => {
      server.close();
      clearInterval(cleanup);
      delete process.env.SESSION_IDLE_TIMEOUT;
      delete process.env.SESSION_MAX_LIFETIME;
    });
    const token = await getToken(base);
    const submitRes = await fetch(`${base}/submit-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    const cookie = getCookie(submitRes);
    await new Promise(r => setTimeout(r, 60));
    const res1 = await fetch(`${base}/protected`, { headers: { Cookie: cookie } });
    assert.strictEqual(res1.status, 200);
    await new Promise(r => setTimeout(r, 60));
    const res2 = await fetch(`${base}/protected`, { headers: { Cookie: cookie } });
    assert.strictEqual(res2.status, 200);
    await new Promise(r => setTimeout(r, 120));
    const res3 = await fetch(`${base}/protected`, { headers: { Cookie: cookie } });
    assert.strictEqual(res3.status, 403);
  });

  await t.test('session allows a single IP change', async () => {
    process.env.PORT = 0;
    process.env.SESSION_IDLE_TIMEOUT = 1000;
    process.env.SESSION_MAX_LIFETIME = 5000;
    const { server, cleanup } = await import(`../server.js?${Math.random()}`);
    const port = server.address().port;
    const base = `http://localhost:${port}`;
    t.after(() => {
      server.close();
      clearInterval(cleanup);
      delete process.env.SESSION_IDLE_TIMEOUT;
      delete process.env.SESSION_MAX_LIFETIME;
    });
    const token = await getToken(base, { 'X-Forwarded-For': '1.1.1.1' });
    const submitRes = await fetch(`${base}/submit-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': '1.1.1.1',
      },
      body: JSON.stringify({ token }),
    });
    const cookie = getCookie(submitRes);
    const res1 = await fetch(`${base}/protected`, {
      headers: { Cookie: cookie, 'X-Forwarded-For': '1.1.1.1' },
    });
    assert.strictEqual(res1.status, 200);
    const res2 = await fetch(`${base}/protected`, {
      headers: { Cookie: cookie, 'X-Forwarded-For': '2.2.2.2' },
    });
    assert.strictEqual(res2.status, 200);
    const res3 = await fetch(`${base}/protected`, {
      headers: { Cookie: cookie, 'X-Forwarded-For': '3.3.3.3' },
    });
    assert.strictEqual(res3.status, 403);
  });
});
