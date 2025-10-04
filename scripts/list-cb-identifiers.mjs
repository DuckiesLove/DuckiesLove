import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const sources = [
  {
    file: path.join(rootDir, 'kinks.json'),
    extract: (json) => json.labels ?? {}
  },
  {
    file: path.join(rootDir, 'kinksurvey', 'data', 'kinks.json'),
    extract: (json) => json
  },
  {
    file: path.join(rootDir, 'data', 'kinks-labels.json'),
    extract: (json) => json.labels ?? {}
  },
  {
    file: path.join(rootDir, 'data', 'labels-overrides.json'),
    extract: (json) => json
  }
];

const combined = new Map();
const provenance = new Map();

for (const { file, extract } of sources) {
  try {
    const content = await readFile(file, 'utf8');
    const json = JSON.parse(content);
    const entries = Object.entries(extract(json));
    for (const [code, label] of entries) {
      if (!code.startsWith('cb_')) continue;
      combined.set(code, label);
      const locations = provenance.get(code) ?? [];
      locations.push(path.relative(rootDir, file));
      provenance.set(code, locations);
    }
  } catch (error) {
    console.error(`Could not read ${file}:`, error);
    process.exitCode = 1;
  }
}

const sorted = Array.from(combined.entries()).sort(([a], [b]) => a.localeCompare(b));

const header = ['Code', 'Label', 'Sources'];
const table = [
  `| ${header.join(' | ')} |`,
  `| ${header.map(() => '---').join(' | ')} |`,
  ...sorted.map(([code, label]) => {
    const sourcesList = (provenance.get(code) ?? []).join(', ');
    return `| ${code} | ${label} | ${sourcesList} |`;
  })
];

console.log(table.join('\n'));
