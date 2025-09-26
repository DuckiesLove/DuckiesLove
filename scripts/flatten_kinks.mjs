import fs from 'node:fs/promises';

function toFlat(data){
  if (Array.isArray(data) && data.length && !('items' in (data[0]||{}))) return data;
  if (data && Array.isArray(data.kinks)) return data.kinks;
  if (Array.isArray(data) && data.length && data[0] && Array.isArray(data[0].items)) {
    const flat = [];
    for (const group of data) {
      const cat = String(group.category ?? group.cat ?? '').trim();
      for (const it of (group.items || [])) {
        flat.push({
          id: it.id ?? `${cat}:${(it.label||'').toLowerCase().replace(/\s+/g,'-')}`,
          label: it.label ?? it.name ?? '',
          name: it.name ?? it.label ?? '',
          type: it.type ?? 'scale',
          category: cat,
          rating: it.rating ?? null
        });
      }
    }
    return flat;
  }
  return data;
}

const inFile  = process.env.IN  || 'data/kinks.json';
const outFile = process.env.OUT || 'data/kinks.flat.json';

const raw = await fs.readFile(inFile, 'utf8');
const json = JSON.parse(raw);
const flat = toFlat(json);
await fs.writeFile(outFile, JSON.stringify(flat, null, 2), 'utf8');
console.log(`Flattened ${inFile} → ${outFile} (rows: ${flat.length})`);
