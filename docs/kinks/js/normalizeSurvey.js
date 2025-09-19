/**
 * Normalize survey JSON formats into a flat list of items.
 * Based on snippet from compatibility upload logic.
 */

export const NAME_KEYS = ["id","key","name","label","title","slug"];
export const SCORE_KEYS = ["rating","score","value","val","points","level"];

export function toNumberish(v) {
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  if (typeof v === "string") {
    const trimmed = v.trim();
    if (/^\d+%$/.test(trimmed)) return Number(trimmed.replace("%",""))/20;
    if (/^\d+\s*\/\s*\d+$/.test(trimmed)) return Number(trimmed.split("/")[0]);
    const n = Number(trimmed);
    if (!Number.isNaN(n)) return n;
  }
  return null;
}

export function pick(obj, keys) {
  for (const k of keys) if (obj && Object.prototype.hasOwnProperty.call(obj, k)) return obj[k];
  return undefined;
}

export function mapRow(row) {
  if (!row || typeof row !== "object") return null;
  const candidate = ["", "item", "question", "meta", "data"]
    .map(prefix => prefix ? row[prefix] : row)
    .find(v => v && typeof v === "object") || row;

  const nameLike = pick(candidate, NAME_KEYS);
  const scoreLike = pick(candidate, SCORE_KEYS);

  const id = (typeof nameLike === "string" ? nameLike : String(nameLike ?? "")).trim();
  const label = id;
  const score = toNumberish(scoreLike);

  if (!id) return null;
  if (score === null) return { id, label, score: null, _warning: "Missing/invalid score" };
  return { id, label, score };
}

export function normalizeSurvey(json) {
  let rows = [];
  if (Array.isArray(json)) rows = json;
  else if (Array.isArray(json?.items)) rows = json.items;
  else if (Array.isArray(json?.answers)) rows = json.answers;
  else if (Array.isArray(json?.data)) rows = json.data;
  else if (json && typeof json === "object") {
    const firstArray = Object.values(json).find(v => Array.isArray(v));
    if (Array.isArray(firstArray)) rows = firstArray;
  }

  if (!Array.isArray(rows)) rows = [];

  const items = [];
  const warnings = [];
  for (const r of rows) {
    const mapped = mapRow(r);
    if (!mapped) continue;
    if (mapped._warning) warnings.push(`${mapped.label}: ${mapped._warning}`);
    items.push({ id: mapped.id, label: mapped.label, score: mapped.score });
  }

  return { items, warnings };
}

export function validateNormalized({ items }) {
  const errors = [];
  if (!items || items.length === 0) {
    errors.push("No recognizable survey items were found. Make sure your JSON includes a name/id and a numeric rating for each item.");
  } else {
    const scored = items.filter(i => typeof i.score === "number");
    if (scored.length === 0) errors.push("Items were found, but none had numeric scores. Include fields like rating, score, or value.");
  }
  return errors;
}

