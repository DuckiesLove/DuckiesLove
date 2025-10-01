import test from 'node:test';
import assert from 'node:assert';

test('kink survey available without authentication', async t => {
  process.env.PORT = 0;
  const { server, cleanup } = await import(`../server.js?${Math.random()}`);
  const base = `http://localhost:${server.address().port}`;
  t.after(() => {
    server.close();
    clearInterval(cleanup);
  });

  const res = await fetch(`${base}/kinks/`);
  assert.strictEqual(res.status, 200);
  const text = await res.text();
  assert.match(text, /Talk Kink/);

  const jsonRes = await fetch(`${base}/data/kinks.json`);
  assert.strictEqual(jsonRes.status, 200);
  assert.match(jsonRes.headers.get('content-type') || '', /^application\/json/i);
  const data = await jsonRes.json();
  assert.ok(data && typeof data === 'object');
  assert.ok(data.labels && typeof data.labels === 'object' && Object.keys(data.labels).length > 0);
  assert.ok(Array.isArray(data.categories) && data.categories.length > 0);

  const fallbackRes = await fetch(`${base}/kinks.json`);
  assert.strictEqual(fallbackRes.status, 200);
  assert.match(fallbackRes.headers.get('content-type') || '', /^application\/json/i);
  const fallbackData = await fallbackRes.json();
  assert.deepStrictEqual(fallbackData, data);
});
