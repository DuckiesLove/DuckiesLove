import test from 'node:test';
import assert from 'node:assert';

test('debug routes access control', async t => {
  await t.test('accessible in non-production', async () => {
    process.env.PORT = 0;
    process.env.NODE_ENV = 'development';
    const { server, cleanup } = await import(`../server.js?${Math.random()}`);
    const port = server.address().port;
    const base = `http://localhost:${port}`;
    t.after(() => {
      server.close();
      clearInterval(cleanup);
      delete process.env.NODE_ENV;
    });
    const res = await fetch(`${base}/debug/sessions`);
    assert.strictEqual(res.status, 200);
  });

  await t.test('requires secret in production', async () => {
    process.env.PORT = 0;
    process.env.NODE_ENV = 'production';
    process.env.DEBUG_SECRET = 'secret';
    const { server, cleanup } = await import(`../server.js?${Math.random()}`);
    const port = server.address().port;
    const base = `http://localhost:${port}`;
    t.after(() => {
      server.close();
      clearInterval(cleanup);
      delete process.env.NODE_ENV;
      delete process.env.DEBUG_SECRET;
    });
    const resForbidden = await fetch(`${base}/debug/sessions`);
    assert.strictEqual(resForbidden.status, 403);
    const resAllowed = await fetch(`${base}/debug/tokens`, {
      headers: { 'x-debug-secret': 'secret' },
    });
    assert.strictEqual(resAllowed.status, 200);
  });
});
