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

// Ensure tokens directory exists
fs.mkdirSync('tokens', { recursive: true });

// Build timestamped filename: tokens/tokens_YYYY-MM-DD_HHMM.txt
const now = new Date();
const pad = (num) => num.toString().padStart(2, '0');
const baseName = `tokens/tokens_${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;

// Ensure we don't overwrite existing files
let fileName = `${baseName}.txt`;
let counter = 1;
while (fs.existsSync(fileName)) {
  fileName = `${baseName}_${counter}.txt`;
  counter++;
}

// Write one token per line
fs.writeFileSync(fileName, `${tokens.join('\n')}\n`, 'utf-8');
