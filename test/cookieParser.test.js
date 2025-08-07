import test from 'node:test';
import assert from 'node:assert';
import { cookieParser, server, cleanup } from '../server.js';

test('cookieParser handles equals in values', t => {
  const req = { headers: { cookie: 'a=1=2; b=3' } };
  cookieParser(req, null, null);
  assert.deepStrictEqual(req.cookies, { a: '1=2', b: '3' });
  t.after(() => {
    server.close();
    clearInterval(cleanup);
  });
});
