import crypto from 'crypto';

const token = crypto.randomBytes(24).toString('hex');
console.log(token);
