import { scryptSync, randomBytes, timingSafeEqual } from 'crypto';

export async function hash(input, rounds = 10) {
  const salt = randomBytes(16);
  const hashed = scryptSync(input, salt, 64);
  return `${salt.toString('hex')}:${hashed.toString('hex')}`;
}

export async function compare(input, stored) {
  const [saltHex, hashHex] = stored.split(':');
  const salt = Buffer.from(saltHex, 'hex');
  const hash = Buffer.from(hashHex, 'hex');
  const derived = scryptSync(input, salt, 64);
  return timingSafeEqual(derived, hash);
}

export default { hash, compare };
