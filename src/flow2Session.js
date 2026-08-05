// ── Flow 2: deterministic gathering sequence ─────────────────────────────────
// The plan → contact → confirm → create sequence is driven HERE, in code — not by
// the LLM. Previously the LLM was asked to volunteer these questions before
// create_design, which it did inconsistently (a complete-sounding opening message
// made it skip straight to creating). Now the LLM's only job for this flow is to
// detect the intent and extract customer/model; once that fires, this state machine
// owns every subsequent step, so the questions ALWAYS get asked, in order.
//
// Pure logic: start()/advance() take the current session + the user's (fuzzy-matched)
// answer and return { state, action }. `state` is the next session state (null when
// the sequence is complete); `action` is a descriptor the caller executes:
//   { type: 'ask' | 'reask', question, options }   → send tappable buttons
//   { type: 'create', args: { customer, model, plan, includeContact } } → build it
// The caller never has to know the step order.

const { matchOption, matchYesNo, normalize, fuzzyEq } = require('./fuzzy');

// ── Deterministic "create a personalised offer" intent detection ─────────────
// Detects the Flow-2 trigger from free text WITHOUT the LLM, tolerant of typos
// ("crate a personalsied bannr"), so the gated demo phone can (re)start the
// session on a matching message. Kept distinct from Flow-1 edit phrasing: the
// trigger needs an explicit "make/create/design …" + "banner/offer/creative",
// whereas Flow-1 edits say "change/edit the price/discount/product".
const ACTION_WORDS = ['create', 'make', 'design', 'generate', 'build', 'prepare', 'craft'];
const ARTIFACT_WORDS = ['banner', 'offer', 'creative', 'poster', 'graphic', 'flyer', 'design'];

function isCreateOfferIntent(text) {
  const toks = normalize(text).split(' ').filter(Boolean);
  if (toks.length === 0) return false;
  const hasAction = toks.some((t) => ACTION_WORDS.some((a) => fuzzyEq(t, a)));
  const hasArtifact = toks.some((t) => ARTIFACT_WORDS.some((a) => fuzzyEq(t, a)));
  const hasPersonalised = toks.some((t) => fuzzyEq(t, 'personalised') || fuzzyEq(t, 'personalized'));
  return (hasAction && hasArtifact) || (hasPersonalised && hasArtifact);
}

// Words that can look like a name but never are (sentence starters / verbs).
const NOT_A_NAME = new Set([
  'i', 'she', 'he', 'they', 'we', 'you', 'the', 'a', 'an', 'my', 'her', 'his', 'their',
  'make', 'create', 'design', 'help', 'please', 'hi', 'hello', 'hey', 'can', 'could',
  'would', 'need', 'want', 'also', 'and', 'but', 'so', 'yesterday', 'today',
]);

function extractCustomer(text, fallback) {
  const capitalised = String(text).match(/\b[A-Z][a-z]+\b/g) || [];
  for (const w of capitalised) {
    if (!NOT_A_NAME.has(w.toLowerCase())) return w;
  }
  return fallback || null;
}

function extractModel(text, models, fallback) {
  const n = normalize(text);
  for (const m of models) {
    const nm = normalize(m);
    if (!nm) continue;
    if (n.includes(nm)) return m; // full name present, e.g. "grand vitara"
    const words = nm.split(' ');
    const key = words[words.length - 1]; // distinctive last word, e.g. "vitara"
    if (key.length >= 3 && n.split(' ').some((t) => fuzzyEq(t, key))) return m;
  }
  return fallback || null;
}

// Best-effort deterministic extraction of customer + model from the trigger text,
// falling back to the configured demo defaults when nothing is found.
function extractOffer(text, { defaults = {}, models = [] } = {}) {
  return {
    customer: extractCustomer(text, defaults.customer),
    model: extractModel(text, models, defaults.model),
  };
}

const STEP = {
  PLAN: 'awaiting_plan',
  CONTACT: 'awaiting_contact',
  CONFIRM: 'awaiting_confirm',
};

const YES_NO = ['✅ Yes', '🙅 No'];
const CONFIRM_OPTIONS = ['✅ Yes', '➡️ No, go ahead'];

function who(state) {
  return state.customer || 'your customer';
}

function askPlan(plans) {
  return { type: 'ask', step: STEP.PLAN, question: 'Which HQ-approved plan should I feature?', options: plans };
}

function askContact(state) {
  return {
    type: 'ask',
    step: STEP.CONTACT,
    question: `Should I add your name & number so ${who(state)} can reach you directly?`,
    options: YES_NO,
  };
}

function askConfirm() {
  return {
    type: 'ask',
    step: STEP.CONFIRM,
    question: "Anything else you'd like to add before I create it?",
    options: CONFIRM_OPTIONS,
  };
}

// Begin a session from the LLM-extracted customer/model. First question is the plan.
function start({ customer, model } = {}, { plans } = {}) {
  const state = {
    step: STEP.PLAN,
    customer: customer || null,
    model: model || null,
    plan: null,
    includeContact: null,
  };
  return { state, action: askPlan(plans) };
}

// Advance the session by one user answer. Fuzzy-matches the answer for the current
// step; on a confident match it moves forward, otherwise it re-asks the same
// question (never silently misfires).
function advance(state, userText, { plans } = {}) {
  switch (state.step) {
    case STEP.PLAN: {
      const plan = matchOption(userText, plans);
      if (!plan) {
        return { state, action: { type: 'reask', step: STEP.PLAN, question: "Sorry, I didn't catch that — please pick a plan:", options: plans } };
      }
      const next = { ...state, plan, step: STEP.CONTACT };
      return { state: next, action: askContact(next) };
    }

    case STEP.CONTACT: {
      const yn = matchYesNo(userText);
      if (yn === null) {
        return { state, action: { type: 'reask', step: STEP.CONTACT, question: 'Just tap Yes or No — add your name & number?', options: YES_NO } };
      }
      const next = { ...state, includeContact: yn === 'yes', step: STEP.CONFIRM };
      return { state: next, action: askConfirm() };
    }

    case STEP.CONFIRM: {
      const yn = matchYesNo(userText);
      if (yn === null) {
        return { state, action: { type: 'reask', step: STEP.CONFIRM, question: 'Tap "No, go ahead" to create it now, or "Yes" if you want to add something.', options: CONFIRM_OPTIONS } };
      }
      // Either answer proceeds to creation: the canned banner has nothing further to
      // gather, and the success caption already invites post-creation edits ("Want to
      // change anything?"). The question is kept for the scripted demo feel.
      return {
        state: null,
        action: {
          type: 'create',
          args: { customer: state.customer, model: state.model, plan: state.plan, includeContact: state.includeContact },
        },
      };
    }

    default:
      // Unknown step — abandon the session rather than loop.
      return { state: null, action: null };
  }
}

module.exports = { start, advance, STEP, isCreateOfferIntent, extractOffer };
