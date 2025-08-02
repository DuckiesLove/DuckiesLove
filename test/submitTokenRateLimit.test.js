import test from 'node:test';
import assert from 'node:assert';

const fetchOpts = {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ token: 'bad-token' }),
};

test('rate limits token submission after five attempts', async t => {
  process.env.PORT = 0;
  const { server, cleanup } = await import('../server.js');
  const port = server.address().port;
  t.after(() => {
    server.close();
    clearInterval(cleanup);
  });
  const url = `http://localhost:${port}/submit-token`;
  for (let i = 0; i < 5; i++) {
    const res = await fetch(url, fetchOpts);
    assert.strictEqual(res.status, 401);
  }
  const res6 = await fetch(url, fetchOpts);
  assert.strictEqual(res6.status, 429);
});
