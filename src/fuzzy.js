// Typo-tolerant matching for the deterministic Flow-2 gathering sequence
// (see flow2Session.js). The salesman may TAP a button (exact title flows back)
// or TYPE a reply with mistakes ("comprehesive", "zero dep rsa", "yess", "nope") —
// both must resolve to the same canonical answer without any LLM call, so the
// step sequencing stays deterministic.

// Classic Levenshtein edit distance (iterative two-row DP).
function levenshtein(a, b) {
  a = String(a);
  b = String(b);
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  let curr = new Array(b.length + 1);
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[b.length];
}

// Lowercase, strip punctuation/emoji to spaces, collapse whitespace. This is what
// makes an emoji-prefixed button title ("✅ Yes", "Zero Dep + RSA") comparable to
// a plain typed answer.
function normalize(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Two tokens are "close enough" if their edit distance is a small fraction of the
// longer token — ~1 typo per 3 chars.
function fuzzyEq(a, b, maxRatio = 0.34) {
  if (a === b) return true;
  const d = levenshtein(a, b);
  return d / Math.max(a.length, b.length) <= maxRatio;
}

const SIGNIFICANT_MIN_LEN = 3;

function significantTokens(normalized) {
  return normalized.split(' ').filter((t) => t.length >= SIGNIFICANT_MIN_LEN);
}

// Resolve a free-text answer to one of a closed set of options (e.g. the HQ plans),
// tolerating typos, partial phrases, and distinctive-word shorthand. Returns the
// matched option string, or null when nothing is confidently close.
function matchOption(input, options) {
  const ni = normalize(input);
  if (!ni) return null;

  // 1) exact (covers a button tap, whose title flows back verbatim)
  for (const o of options) if (normalize(o) === ni) return o;

  // 2) full-phrase containment either direction ("engine protect combo" vs a
  //    longer title, or a typed superset of a short option)
  for (const o of options) {
    const no = normalize(o);
    if (ni.length >= SIGNIFICANT_MIN_LEN && (no.includes(ni) || ni.includes(no))) return o;
  }

  // 3) a distinctive word that uniquely identifies one option ("comprehensive",
  //    "rsa", "engine") — even with a typo in that word.
  const itoks = significantTokens(ni);
  for (const it of itoks) {
    const owners = options.filter((o) =>
      significantTokens(normalize(o)).some((ot) => fuzzyEq(it, ot))
    );
    if (owners.length === 1) return owners[0];
  }

  // 4) fall back to majority token overlap (at least half an option's significant
  //    words fuzzy-matched by the input).
  let best = null;
  let bestScore = 0;
  for (const o of options) {
    const otoks = significantTokens(normalize(o));
    if (otoks.length === 0) continue;
    let hits = 0;
    for (const ot of otoks) if (itoks.some((it) => fuzzyEq(it, ot))) hits++;
    const score = hits / otoks.length;
    if (score > bestScore) {
      bestScore = score;
      best = o;
    }
  }
  return bestScore >= 0.5 ? best : null;
}

const YES_WORDS = ['yes', 'y', 'ya', 'yaa', 'yah', 'yeah', 'yep', 'yup', 'sure', 'ok', 'okay', 'okey', 'haan', 'han', 'ha', 'add', 'yess', 'yesss'];
const NO_WORDS = ['no', 'n', 'nope', 'nah', 'na', 'naa', 'skip', 'dont'];
// Phrases that mean "stop asking, just create it" — treated as a 'no' (nothing to add).
const PROCEED_PHRASES = ['go ahead', 'goahead', 'go head', 'proceed', 'create it', 'make it', 'nothing', 'no thanks', 'all good', 'looks good', 'ready'];

// Resolve a free-text answer to 'yes' | 'no' | null (ambiguous / unrecognised).
// Typo-tolerant and emoji-safe. Callers decide what yes/no means per question.
function matchYesNo(input) {
  const n = normalize(input);
  if (!n) return null;

  if (PROCEED_PHRASES.some((p) => n.includes(p))) return 'no';

  const toks = n.split(' ');
  const isYes = toks.some((t) => YES_WORDS.includes(t) || fuzzyEq(t, 'yes') || fuzzyEq(t, 'yeah') || fuzzyEq(t, 'sure'));
  const isNo = toks.some((t) => NO_WORDS.includes(t) || fuzzyEq(t, 'no', 0.5) || fuzzyEq(t, 'nope'));

  if (isYes && !isNo) return 'yes';
  if (isNo && !isYes) return 'no';
  return null;
}

module.exports = { levenshtein, normalize, fuzzyEq, matchOption, matchYesNo };
