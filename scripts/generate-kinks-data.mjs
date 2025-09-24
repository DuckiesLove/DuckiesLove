import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const SOURCE_FILE = path.join(ROOT, 'template-survey.json');
const OUTPUTS = [
  path.join(ROOT, 'data', 'kinks.json'),
  path.join(ROOT, 'docs', 'kinks', 'data', 'kinks.json')
];

function slugify(value) {
  const normalized = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-');
  const trimmed = normalized.replace(/^-+|-+$/g, '');
  return trimmed || 'item';
}

function uniqueSlug(base, counterMap) {
  const current = counterMap.get(base) || 0;
  counterMap.set(base, current + 1);
  if (current === 0) {
    return base;
  }
  return `${base}-${current + 1}`;
}

function deriveType(entry) {
  if (entry?.type) {
    const raw = String(entry.type).toLowerCase();
    if (raw === 'bool' || raw === 'checkbox') return 'bool';
    if (raw === 'dropdown' || raw === 'multi' || raw === 'text') return 'text';
    return raw;
  }
  if (Object.prototype.hasOwnProperty.call(entry || {}, 'rating')) {
    return 'scale';
  }
  return 'text';
}

function extractLabel(entry) {
  return entry?.name || entry?.label || entry?.question || '';
}

function buildDataset(template) {
  const slugCounts = new Map();
  const categories = [];

  for (const [categoryName, sections] of Object.entries(template)) {
    if (!sections || typeof sections !== 'object') continue;
    const items = [];

    for (const [sectionName, entries] of Object.entries(sections)) {
      if (!Array.isArray(entries)) continue;
      for (const entry of entries) {
        const label = extractLabel(entry);
        if (!label) continue;
        const baseSlug = slugify(`${categoryName} ${sectionName} ${label}`);
        const id = uniqueSlug(baseSlug, slugCounts);
        const type = deriveType(entry);
        items.push({ id, label, type });
      }
    }

    if (items.length) {
      categories.push({ category: categoryName, items });
    }
  }

  return categories;
}

async function main() {
  const sourceText = await readFile(SOURCE_FILE, 'utf8');
  const template = JSON.parse(sourceText);
  const dataset = buildDataset(template);
  const json = JSON.stringify(dataset, null, 2) + '\n';

  for (const output of OUTPUTS) {
    const dir = path.dirname(output);
    if (!existsSync(dir)) {
      throw new Error(`Output directory missing: ${dir}`);
    }
    await writeFile(output, json, 'utf8');
  }

  console.log(`Generated ${dataset.length} categories with ${dataset.reduce((sum, cat) => sum + cat.items.length, 0)} items.`);
}

main().catch(err => {
  console.error('[generate-kinks-data] Failed:', err);
  process.exit(1);
});
