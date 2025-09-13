if (typeof window === 'undefined') {
  globalThis.window = {};
}

/* ================================
   calculateRoleScores.js (DROP-IN)
   Adds Poly/Mono roles, maps answers → roles,
   and exposes a single scoring function.
   Paste this whole file and replace your existing scoring module.
================================== */

/* --- 0) Helpers ----------------------------------------------------- */
(function () {
  const LOG = (...a) => console.log("[IKA-SCORE]", ...a);

  // Coerce survey JSON into a flat list of {q,label,text,value} items
  function flattenSurvey(raw) {
    if (!raw) return [];
    // Common shapes: array of {question, answer} OR object map {label: value}
    if (Array.isArray(raw)) {
      return raw
        .map((r, i) => {
          const label = r.label || r.key || r.id || r.question || `Q${i + 1}`;
          const text = r.text || r.question || label;
          const value =
            r.value ?? r.answer ?? r.score ?? r.rating ?? r.choice ?? r.selected ?? null;
          return { q: label, label, text, value };
        })
        .filter(Boolean);
    }
    // object map
    return Object.entries(raw).map(([k, v], i) => {
      const label = k;
      const text = k;
      const value =
        (v && typeof v === "object" && ("value" in v || "answer" in v))
          ? (v.value ?? v.answer ?? v.score ?? v.rating ?? v.choice ?? v.selected ?? null)
          : v;
      return { q: label, label, text, value };
    });
  }

  // normalize string for keyword matching
  function norm(s) {
    return String(s ?? "")
      .toLowerCase()
      .replace(/[_\s]+/g, " ")
      .trim();
  }

  // quick test if value means YES/AGREE or numeric 4-5
  function isAffirmative(v) {
    if (v == null) return false;
    const n = Number(v);
    if (Number.isFinite(n)) return n >= 4; // 1–5 scale: treat 4–5 as “yes”
    const t = norm(v);
    return ["yes", "y", "true", "agree", "strongly agree"].some((w) => t === w);
  }

  // map of roles for aliases
  function normalizeRoleLabel(role) {
    return (window.IKA_ALIASES && window.IKA_ALIASES[role]) || role;
  }

  /* --- 1) Role Bank ------------------------------------------------- */
  // Merge/replace your BANK with this expanded set.
  window.BANK = Array.from(
    new Set([
      // Core BDSM Roles
      "Dominant","Submissive","Switch",
      "Master","Mistress","Owner","Slave",
      "Bedroom Dom","Bedroom Submissive",
      "Dom-Leaning Switch","Bottom-Leaning Switch",
      "Brat","Brat Tamer","Brat Handler","Brat Enabler",
      "Caregiver","Daddy Dom","Mommy Dom",
      "Ageplayer","Age Regressor","little",
      "Service Top","service submissive","service slave","Service Switch",
      "Primal Predator","Primal Prey","Primal Switch",
      "Primal Sadist","Primal Masochist","Primal Sadomasochist",
      "Sadist","Masochist",
      "Emotional Sadist","Emotional Masochist","Emotional Sadomasochist",
      "Intellectual Sadist","Intellectual Masochist","Intellectual Sadomasochist",
      "Degrader","degradee","Pleasure Dom","Pleasure Sadist",
      "Impact Top","Impact Bottom","Impact Switch",
      "Rigger","Rope Top","Rope Bottom","Rope Switch","Rope bunny",
      "Bondage Top","Bondage Bottom","Bondage Switch",
      "Latex Top","Latex Bottom","Latex Switch",
      "Leather Top","Leather Bottom","Leather Switch",
      "Foot Top","Foot Bottom","Foot Switch",
      "Needle Top","Needle Bottom","Needle Switch",
      "Fisting Top","Fisting Bottom",
      "Fire Top","Fire Bottom","Fire Switch",
      "Electro Top","Electro Bottom","Electro Switch",
      "Hypno Top","hypno bottom","Hypno Switch",
      "Watersports Top","Watersports Bottom","Watersports Switch",
      "Exhibitionist","Voyeur","Cuckold",
      "Cum Princess","Cum Slut","Cock Worshipper","Toy",
      "Pet","Owner",
      "Experimentalist","Non-monogamist",
      "Prince","Princess",

      // Relationship styles (Poly/Mono spectrum)
      "Poly Webs","Polycule","Kitchen Table Poly","Parallel Poly",
      "Garden Party Poly","Solo Poly","Triad / Throuple","Vee",
      "Quad","Hierarchical Poly","Comet",
      "Polyfidelity","Ethical Non-Monogamy (ENM)","Relationship Anarchy (RA)",
      "Monogamish","Mono-Polyamorous","Monogamy"
    ])
  );

  /* --- 2) Aliases (optional but recommended) ----------------------- */
  window.IKA_ALIASES = Object.assign(
    {
      "Daddy/Mommy": "Daddy Dom",
      "Daddy/Mommy Dom": "Daddy Dom",
      Mommy: "Mommy Dom",
      "Rope Bunny": "Rope bunny",
      "Hypno Bottom": "hypno bottom",
      "Service Submissive": "service submissive",
      "Service Slave": "service slave",
      "Owner (Pet Play)": "Owner",
      "CumPlay Princess": "Cum Princess",
      "CumPlay Slut": "Cum Slut",
      "Kitchen Table Poly (KTP)": "Kitchen Table Poly",
      "Triad, Throuple": "Triad / Throuple",
      "KTP": "Kitchen Table Poly",
      "RA": "Relationship Anarchy (RA)"
    },
    window.IKA_ALIASES || {}
  );

  /* --- 3) Role Mapping by Keywords / Questions --------------------- */
  // ROLE_MAP accepts exact question texts OR keywords. When matched and the answer is affirmative,
  // points will be added to the listed roles.
  // You can expand or tailor these strings to your survey’s exact wording.
  window.ROLE_MAP = Object.assign(
    {
      // Monogamy spectrum
      "prefer one partner only": ["Monogamy"],
      "keep metamours separate": ["Parallel Poly"],
      "partners and metamours close friends": ["Kitchen Table Poly"],
      "exclusivity inside group": ["Polyfidelity"],
      "independence even when non-monogamous": ["Solo Poly"],
      "group relationships 3 or 4 people": ["Triad / Throuple", "Quad"],
      "honesty with multiple partners": ["Ethical Non-Monogamy (ENM)"],
      "long-distance partner I see rarely": ["Comet"],
      "reject labels prioritize autonomy": ["Relationship Anarchy (RA)"],
      "prioritize a primary partner": ["Hierarchical Poly"],
      "mostly monogamous with some openness": ["Monogamish"],
      "i am monogamous but my partner is poly": ["Mono-Polyamorous"],
      "poly webs": ["Poly Webs"],
      "polycule": ["Polycule"],
      "garden party poly": ["Garden Party Poly"],
      "vee structure": ["Vee"],

      // A few BDSM tie-ins (examples—adjust as needed)
      "i like to be in control": ["Dominant","Daddy Dom"],
      "i like to be controlled": ["Submissive"],
      "i am a brat": ["Brat"],
      "i enjoy taming brats": ["Brat Tamer"],
      "i like impact play": ["Impact Top","Impact Bottom","Impact Switch"],
      "i enjoy rope": ["Rigger","Rope Top","Rope Bottom","Rope Switch"],
      "i enjoy exhibitionism": ["Exhibitionist"],
      "i enjoy being degraded": ["degradee","Masochist","Emotional Masochist"],
      "i enjoy degrading": ["Degrader","Sadist","Emotional Sadist"]
    },
    window.ROLE_MAP || {}
  );

  /* --- 4) Scoring Weights ----------------------------------------- */
  // When an item matches (keyword in question/label) and is affirmative,
  // we add POINTS.YES. If the value is numeric 1–5, scale extra.
  const POINTS = {
    YES: 3,           // base points for an affirmative match
    SCALE_EXTRA: 2    // additional * (score-3) if score is 1–5; so 4 => +2, 5 => +4
  };

  /* --- 5) Main Scoring Function ----------------------------------- */
  // Input: user survey JSON (array or object)
  // Output: array of { role, score, pct } sorted desc by pct
  function IKA_scoreRoles(rawSurvey) {
    const items = flattenSurvey(rawSurvey);
    const scores = new Map(window.BANK.map((r) => [r, 0]));

    // Build a searchable list of [needle (lowercased), roles[]]
    const needles = Object.entries(window.ROLE_MAP).map(([k, roles]) => ({
      needle: norm(k),
      roles: roles.map(normalizeRoleLabel)
    }));

    for (const it of items) {
      const text = norm(`${it.q} ${it.label} ${it.text}`);
      const val = it.value;
      const numeric = Number(val);
      const isNum = Number.isFinite(numeric);
      const affirmative = isAffirmative(val);

      // Try to locate matching mappings by substring
      for (const m of needles) {
        if (!m.needle) continue;
        if (text.includes(m.needle)) {
          // If user said "yes" or rated high, add points
          if (affirmative || (isNum && numeric >= 4)) {
            const add =
              POINTS.YES + (isNum ? Math.max(0, (numeric - 3)) * POINTS.SCALE_EXTRA : 0);
            for (const role of m.roles) {
              if (scores.has(role)) scores.set(role, scores.get(role) + add);
            }
          }
        }
      }
    }

    // Normalize to percentages (0–100). If all zeros, return 0s.
    const maxScore = Math.max(0, ...scores.values());
    const result = Array.from(scores.entries())
      .map(([role, score]) => ({
        role,
        score,
        pct: maxScore > 0 ? Math.round((score / maxScore) * 100) : 0
      }))
      .sort((a, b) => b.pct - a.pct || b.score - a.score || a.role.localeCompare(b.role));

    // cache last results for exporters
    window.IKA_lastResults = result;
    LOG("scored roles:", result.slice(0, 10), "... total:", result.length);
    return result;
  }

  // Expose API
  window.IKA_scoreRoles = IKA_scoreRoles;
})();

export function calculateRoleScores(rawSurvey) {
  return window.IKA_scoreRoles(rawSurvey).map(({ role, pct }) => ({
    name: role,
    percent: pct
  }));
}

export const roles = window.BANK;

