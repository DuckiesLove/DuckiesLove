import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'out', '.cache']);
const TEXT_EXTENSIONS = new Set([
  '',
  'cjs',
  'conf',
  'css',
  'htm',
  'html',
  'ini',
  'js',
  'json',
  'mjs',
  'md',
  'mdx',
  'scss',
  'sh',
  'ts',
  'tsx',
  'txt',
  'yaml',
  'yml',
]);
const SPECIAL_FILES = new Set(['Procfile', 'Dockerfile']);
const MAX_SIZE = 5 * 1024 * 1024; // 5MB safety cap

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      files.push(...(await walk(fullPath)));
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).slice(1).toLowerCase();
      if (TEXT_EXTENSIONS.has(ext) || SPECIAL_FILES.has(entry.name)) {
        files.push(fullPath);
      }
    }
  }
  return files;
}

function conflictRegex() {
  return /<<<<<<<[^\n\r]*\r?\n([\s\S]*?)\r?\n=======\r?\n([\s\S]*?)\r?\n>>>>>>>[^\n\r]*\r?\n?/g;
}

function lineNumbersForMarkers(src) {
  const lines = [];
  let line = 1;
  let idx = 0;
  while (idx <= src.length) {
    const next = src.indexOf('\n', idx);
    const segment = src.slice(idx, next === -1 ? src.length : next);
    if (
      segment.startsWith('<<<<<<<') ||
      segment.startsWith('>>>>>>>') ||
      segment === '======='
    ) {
      lines.push(line);
    }
    if (next === -1) break;
    idx = next + 1;
    line += 1;
  }
  return lines;
}

async function inspectFile(filePath) {
  const info = await stat(filePath);
  if (!info.isFile() || info.size > MAX_SIZE) return null;
  const raw = await readFile(filePath, 'utf8');
  if (!/<<<<<<<|=======|>>>>>>>/.test(raw)) return null;
  const markerPattern = conflictRegex();
  if (!markerPattern.test(raw)) return null;
  const lines = lineNumbersForMarkers(raw);
  if (lines.length === 0) return null;
  return { filePath, lines };
}

async function main() {
  try {
    const files = await walk(ROOT);
    const conflicts = [];
    for (const file of files) {
      try {
        const result = await inspectFile(file);
        if (result) conflicts.push(result);
      } catch (err) {
        console.warn(`Skipping ${path.relative(ROOT, file)}: ${err.message}`);
      }
    }

    if (conflicts.length > 0) {
      console.error('\n❌ Conflict markers found:');
      for (const { filePath, lines } of conflicts) {
        const rel = path.relative(ROOT, filePath);
        console.error(`  - ${rel} (lines ${lines.join(', ')})`);
      }
      process.exit(1);
    }

    console.log('✅ No conflict markers');
  } catch (err) {
    console.error('check failed:', err.message);
    process.exit(2);
  }
}

main();
