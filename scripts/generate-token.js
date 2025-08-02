import jwt from 'jsonwebtoken';

const secret = process.env.JWT_SECRET || 'secret';
const payload = { timestamp: Date.now() };

const token = jwt.sign(payload, secret, { expiresIn: '1h' });

console.log(token);

