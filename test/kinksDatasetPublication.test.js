import test from 'node:test';
import assert from 'node:assert';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const DATA_PATH = path.join(ROOT, 'data', 'kinks.json');
const DOCS_DATA_PATH = path.join(ROOT, 'docs', 'kinks', 'data', 'kinks.json');

async function load(filePath) {
  const contents = await readFile(filePath, 'utf8');
  assert.ok(contents.length > 0, `${filePath} should not be empty`);
  return contents;
}

test('kinks dataset published with static assets', async () => {
  const [rootData, docsData] = await Promise.all([
    load(DATA_PATH),
    load(DOCS_DATA_PATH)
  ]);

  assert.strictEqual(rootData, docsData, 'data/kinks.json and docs/kinks/data/kinks.json should match');
});
