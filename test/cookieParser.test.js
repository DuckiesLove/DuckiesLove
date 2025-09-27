import test from 'node:test';
import assert from 'node:assert';
import { cookieParser, server, cleanup } from '../server.js';

function stopServer() {
  if (server?.listening) {
    server.close();
  }
  clearInterval(cleanup);
}

test('cookieParser handles equals in values', t => {
  const req = { headers: { cookie: 'a=1=2; b=3' } };
  cookieParser(req, null, null);
  assert.deepStrictEqual(req.cookies, { a: '1=2', b: '3' });
  t.after(stopServer);
});

test('cookieParser traps invalid encoding without throwing', t => {
  const req = { headers: { cookie: 'bad=%E0%A4%A' } };
  cookieParser(req, null, null);
  assert.strictEqual(req.cookies.bad, '%E0%A4%A');
  t.after(stopServer);
});
