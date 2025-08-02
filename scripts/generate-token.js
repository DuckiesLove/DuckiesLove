import fs from 'fs';
import { randomBytes } from 'crypto';
import bcrypt from '../lib/bcrypt.js';

const [,, ip] = process.argv;
if (!ip) {
  console.error('Usage: node scripts/generate-token.js <ip>');
  process.exit(1);
}

const token = randomBytes(32).toString('hex');
const hash = await bcrypt.hash(token, 10);
const expires = Date.now() + 1000 * 60 * 60; // 1 hour

let store = [];
try {
  store = JSON.parse(fs.readFileSync('tokens.json', 'utf8'));
} catch {
  store = [];
}

store.push({ hash, ip, expires, used: false });
fs.writeFileSync('tokens.json', JSON.stringify(store, null, 2));

console.log(token);
