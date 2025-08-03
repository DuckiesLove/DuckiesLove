import crypto from 'crypto';
import fs from 'fs';

const generateToken = () => crypto.randomBytes(24).toString('hex');

const NUM_TOKENS = 10;
const tokens = [];

for (let i = 0; i < NUM_TOKENS; i++) {
  tokens.push(generateToken());
}

console.log("\ud83d\udd10 Generated One-Time Tokens:");
tokens.forEach((token, index) => {
  console.log(`${index + 1}: ${token}`);
});

// Optional: write to file
fs.writeFileSync('tokens.txt', tokens.join('\n'), 'utf-8');
