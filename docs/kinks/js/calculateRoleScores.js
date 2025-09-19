/* ============================================================================
  calculateRoleScores.js — CLEAN, CONFLICT-FREE REPLACEMENT
  - No imports required (ROLE_MAP is defined here)
  - Works as a browser script AND as an ES module
  - Expands the role list (BDSM + relationship styles)
  - Maps answers → roles via keyword matching
  - Exposes:
      window.BANK, window.ROLE_MAP, window.IKA_scoreRoles (browser)
      export const roles, calculateRoleScores (ES module)
============================================================================ */

/* ------------------------ utilities ------------------------ */
const _LOG = (...a) => console.log("[IKA-SCORE]", ...a);

function _norm(s) {
  return String(s ?? "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[_\s]+/g, " ")
    .trim();
}

function _isAffirmative(v) {
  if (v == null) return false;
  const n = Number(v);
  if (Number.isFinite(n)) return n >= 4; // treat 4–5 as “yes” on 1–5 scales
  const t = _norm(v);
  return ["yes", "y", "true", "agree", "strongly agree", "hell yes", "love"].includes(t);
}

function _flattenSurvey(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.map((r, i) => {
      const label = r.label || r.key || r.id || r.question || `Q${i + 1}`;
      const text  = r.text  || r.question || label;
      const value = r.value ?? r.answer ?? r.score ?? r.rating ?? r.choice ?? r.selected ?? null;
      return { q: label, label, text, value };
    });
  }
  // object map
  return Object.entries(raw).map(([k, v]) => {
    const value =
      (v && typeof v === "object" && ("value" in v || "answer" in v))
        ? (v.value ?? v.answer ?? v.score ?? v.rating ?? v.choice ?? v.selected ?? null)
        : v;
    return { q: k, label: k, text: k, value };
  });
}

/* ------------------------ role bank ------------------------ */
const BANK = Array.from(new Set([
  // Core / power
  "Dominant","Submissive","Switch",
  "Master","Mistress","Owner","Slave",
  "Bedroom Dom","Bedroom Submissive","Dom-Leaning Switch","Bottom-Leaning Switch",

  // Brat / caregiver / age
  "Brat","Brat Tamer","Brat Handler","Brat Enabler",
  "Caregiver","Daddy Dom","Mommy Dom","Ageplayer","Age Regressor","little",

  // Service
  "Service Top","service submissive","service slave","Service Switch",

  // Primal / S&M variants
  "Primal Predator","Primal Prey","Primal Switch",
  "Primal Sadist","Primal Masochist","Primal Sadomasochist",
  "Sadist","Masochist",
  "Emotional Sadist","Emotional Masochist","Emotional Sadomasochist",
  "Intellectual Sadist","Intellectual Masochist","Intellectual Sadomasochist",
  "Degrader","degradee","Pleasure Dom","Pleasure Sadist",

  // Impact / bondage / rope
  "Impact Top","Impact Bottom","Impact Switch",
  "Rigger","Rope Top","Rope Bottom","Rope Switch","Rope bunny",
  "Bondage Top","Bondage Bottom","Bondage Switch",

  // Materials
  "Latex Top","Latex Bottom","Latex Switch",
  "Leather Top","Leather Bottom","Leather Switch",

  // Feet
  "Foot Top","Foot Bottom","Foot Switch",

  // Needles / fisting / fire / electro / hypno
  "Needle Top","Needle Bottom","Needle Switch",
  "Fisting Top","Fisting Bottom",
  "Fire Top","Fire Bottom","Fire Switch",
  "Electro Top","Electro Bottom","Electro Switch",
  "Hypno Top","hypno bottom","Hypno Switch",

  // Watersports
  "Watersports Top","Watersports Bottom","Watersports Switch",

  // Exhibition / voyeur / cuck / worship / cum play
  "Exhibitionist","Voyeur","Cuckold","Cock Worshipper","Cum Princess","Cum Slut","Toy",

  // Pet
  "Pet","Owner",

  // Misc
  "Experimentalist","Non-monogamist","Prince","Princess",

  // Relationship styles (poly/mono spectrum)
  "Poly Webs","Polycule","Kitchen Table Poly","Parallel Poly","Garden Party Poly",
  "Solo Poly","Triad / Throuple","Vee","Quad","Hierarchical Poly","Comet",
  "Polyfidelity","Ethical Non-Monogamy (ENM)","Relationship Anarchy (RA)",
  "Monogamish","Mono-Polyamorous","Monogamy"
]));

/* ------------------------ aliases ------------------------ */
const ALIASES = {
  "Daddy/Mommy":"Daddy Dom",
  "Daddy/Mommy Dom":"Daddy Dom",
  Mommy:"Mommy Dom",
  "Rope Bunny":"Rope bunny",
  "Hypno Bottom":"hypno bottom",
  "Service Submissive":"service submissive",
  "Service Slave":"service slave",
  "Kitchen Table Poly (KTP)":"Kitchen Table Poly",
  "Triad, Throuple":"Triad / Throuple",
  KTP:"Kitchen Table Poly",
  RA:"Relationship Anarchy (RA)"
};
function _roleLabel(role){ return ALIASES[role] || role; }

/* ------------------------ role mapping ------------------------ */
/* Extend or customize these keys to match your survey wording */
const ROLE_MAP = {
  // Relationship styles
  "prefer one partner only": ["Monogamy"],
  "keep metamours separate": ["Parallel Poly"],
  "partners and metamours are close friends": ["Kitchen Table Poly"],
  "exclusivity inside group": ["Polyfidelity"],
  "independence even when non-monogamous": ["Solo Poly"],
  "group relationships 3 or 4 people": ["Triad / Throuple","Quad"],
  "honesty with multiple partners": ["Ethical Non-Monogamy (ENM)"],
  "long-distance partner i see rarely": ["Comet"],
  "reject labels prioritize autonomy": ["Relationship Anarchy (RA)"],
  "prioritize a primary partner": ["Hierarchical Poly"],
  "mostly monogamous with some openness": ["Monogamish"],
  "i am monogamous but my partner is poly": ["Mono-Polyamorous"],
  "poly webs": ["Poly Webs"],
  "polycule": ["Polycule"],
  "garden party poly": ["Garden Party Poly"],
  "vee structure": ["Vee"],

  // Power / brat / caregiver
  "i like to be in control": ["Dominant","Bedroom Dom","Daddy Dom"],
  "i like to be controlled": ["Submissive","Bedroom Submissive"],
  "i am a brat": ["Brat"],
  "i enjoy taming brats": ["Brat Tamer","Brat Handler"],

  // Impact / rope / bondage
  "i like impact play": ["Impact Top","Impact Bottom","Impact Switch"],
  "i enjoy rope": ["Rigger","Rope Top","Rope Bottom","Rope Switch"],
  "i enjoy restraint or bondage": ["Bondage Top","Bondage Bottom","Bondage Switch"],

  // Exhibitionism / degradation
  "i enjoy exhibitionism": ["Exhibitionist"],
  "i enjoy being degraded": ["degradee","Masochist","Emotional Masochist"],
  "i enjoy degrading": ["Degrader","Sadist","Emotional Sadist"],

  // Feet
  "foot play": ["Foot Top","Foot Bottom","Foot Switch"],

  // Materials
  "latex": ["Latex Top","Latex Bottom","Latex Switch"],
  "leather": ["Leather Top","Leather Bottom","Leather Switch"],

  // Watersports
  "watersports": ["Watersports Top","Watersports Bottom","Watersports Switch"],

  // Pet play
  "pet play": ["Pet","Owner"],

  // Hypno / electro / fire / needles / fisting
  "hypnosis or trance": ["Hypno Top","hypno bottom","Hypno Switch"],
  "electro play": ["Electro Top","Electro Bottom","Electro Switch"],
  "fire play": ["Fire Top","Fire Bottom","Fire Switch"],
  "needle play": ["Needle Top","Needle Bottom","Needle Switch"],
  "fisting": ["Fisting Top","Fisting Bottom"],

  // Voyeur / cuck / cum & worship
  "voyeur": ["Voyeur"],
  "cuck": ["Cuckold"],
  "cum play": ["Cum Princess","Cum Slut"],
  "cock worship": ["Cock Worshipper"],

  // Service
  "protocol or service": ["Service Top","service submissive","service slave","Service Switch"],

  // Experimental / non-mono generic
  "experiment or try anything": ["Experimentalist"],
  "non monogamous": ["Non-monogamist"]
};

/* ------------------------ weights ------------------------ */
const POINTS = { YES: 3, SCALE_EXTRA: 2 };

/* ------------------------ scorer ------------------------ */
function IKA_scoreRoles(rawSurvey) {
  const items = _flattenSurvey(rawSurvey);
  const scores = new Map(BANK.map((r) => [r, 0]));

  const needles = Object.entries(ROLE_MAP).map(([k, roles]) => ({
    needle: _norm(k),
    roles: roles.map(_roleLabel),
  }));

  for (const it of items) {
    const text = _norm(`${it.q} ${it.label} ${it.text}`);
    const val = it.value;
    const num = Number(val);
    const isNum = Number.isFinite(num);
    const yes = _isAffirmative(val);

    for (const m of needles) {
      if (m.needle && text.includes(m.needle)) {
        if (yes || (isNum && num >= 3)) {
          const add =
            POINTS.YES + (isNum ? Math.max(0, num - 3) * POINTS.SCALE_EXTRA : 0);
          for (const role of m.roles) {
            if (scores.has(role)) scores.set(role, scores.get(role) + add);
          }
        }
      }
    }
  }

  const maxScore = Math.max(0, ...scores.values());
  const result = Array.from(scores.entries())
    .map(([role, score]) => ({
      role,
      score,
      pct: maxScore > 0 ? Math.round((score / maxScore) * 100) : 0
    }))
    .sort((a, b) => b.pct - a.pct || b.score - a.score || a.role.localeCompare(b.role));

  // cache for PDF/exporters
  if (typeof window !== "undefined") window.IKA_lastResults = result;
  _LOG("scored roles (top 10):", result.slice(0, 10), " … total:", result.length);
  return result;
}

/* ------------------------ browser globals ------------------------ */
if (typeof window !== "undefined") {
  window.BANK = window.BANK || BANK;
  window.ROLE_MAP = Object.assign({}, ROLE_MAP, window.ROLE_MAP || {});
  window.IKA_scoreRoles = IKA_scoreRoles;
}

/* ------------------------ ES module exports ------------------------ */
export const roles = BANK;
export function calculateRoleScores(rawSurvey) {
  // Return a simplified shape if you prefer
  return IKA_scoreRoles(rawSurvey).map(({ role, pct }) => ({ name: role, percent: pct }));
}

