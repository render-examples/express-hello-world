// ── Flow 2: canned personalised customer offers (image.source === 'local') ────
// A car-dealership salesman creates a personalised, on-brand offer to send to a
// specific customer (e.g. an insurance offer for someone who test drove a model).
// No Adobe Express calls — the creative resolves to pre-hosted canned image URLs
// (English / Hindi) in data/offer-design.json. Self-contained: never touches the
// express flow. Governance (no below-floor pricing) is enforced in the GPT prompt.

const fs = require('node:fs');
const path = require('node:path');
const { recordEdits, createDesign: registerDesign } = require('./imageStore');
const { buildEditOptions, formatAllowedEdits } = require('./editOptions');

function loadOfferDesign() {
  const filePath = process.env.OFFER_DESIGN_FILE || path.join(__dirname, '..', 'data', 'offer-design.json');
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

// Approved plans + featured governance details, plus the fallback customer/model
// and known-model list used by the deterministic Flow-2 trigger (flow2Session.js).
function getOfferContext() {
  const design = loadOfferDesign();
  return {
    plans: design.plans || [],
    featured: design.featured || null,
    defaults: design.defaults || {},
    models: design.models || [],
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Stream progress messages one at a time with a pause between them, so generation
// feels like real work. No-op without a sender (keeps unit tests fast). Tunable
// via GEN_STEP_DELAY_MS.
async function streamProgress(sendText, phoneNumber, messages) {
  if (typeof sendText !== 'function') return;
  const delay = Number(process.env.GEN_STEP_DELAY_MS ?? 1500);
  for (const message of messages) {
    await sendText(phoneNumber, message);
    await sleep(delay);
  }
}

function hasHindi(value) {
  return /[ऀ-ॿ]/.test(String(value));
}

// A translation request: the model may pass Devanagari text or the word "Hindi"
// under any key. Detect either so "make it in Hindi" (however phrased) always maps
// to the Hindi creative.
function wantsHindi(rawEdits) {
  const text = Object.entries(rawEdits || {}).flat().map(String);
  return text.some(hasHindi) || text.some((s) => /\bhindi\b/i.test(s));
}

function localEditElements(image) {
  return (image.design.slots?.editable || []).map((slot) => ({
    name: slot.name,
    type: slot.type || 'text',
    value: image.currentEdits[slot.name] ?? '',
  }));
}

// create_design: register a personalised offer and send the English creative,
// streaming progress first so it feels generated rather than instant.
async function createDesign(phoneNumber, { customer, model, plan, includeContact } = {}, { sendImage, sendText }) {
  const design = loadOfferDesign();
  const who = customer || 'your customer';
  const car = model || 'their vehicle';
  const name = `${car} offer for ${who}`;
  const image = registerDesign(phoneNumber, { name, design });

  const steps = [
    `🎨 Creating ${who}'s personalised offer…`,
    '📦 Pulling Maruti Suzuki Arena branding & approved colours…',
    `📱 Adding the ${car} with the approved ${plan || 'insurance'} plan…`,
  ];
  if (includeContact) steps.push('📍 Personalising it and adding your contact…');
  await streamProgress(sendText, phoneNumber, steps);

  const contactText = includeContact ? ' with your contact' : '';
  const caption = `Here you go 🚗 ${who}'s personalised ${car} offer${contactText} — on-brand and ready to forward.\n\nWant to change anything?`;

  console.log('[action:create_design]', { phoneNumber, customer, model, plan, includeContact, image: design.images.en });
  try {
    await sendImage(phoneNumber, design.images.en, caption);
  } catch (err) {
    console.error('[localFlow.createDesign] sendImage error', { message: err.message });
    return `I created ${who}'s offer, but couldn't send the image right now — try asking me to resend it.`;
  }

  return { skipSend: true, historyText: caption };
}

// Apply an edit. The only visual edit on this canned offer is the language
// (English ↔ Hindi); brand, price and plan are HQ-locked, so any other edit just
// re-sends the current creative. Below-floor pricing is refused upstream in the
// GPT prompt, so it never reaches here.
async function editGraphic(phoneNumber, image, rawEdits, { sendImage, sendText }) {
  const design = image.design;
  const toHindi = wantsHindi(rawEdits);
  const language = toHindi ? 'Hindi' : (image.currentEdits.language || 'English');

  recordEdits(phoneNumber, image.id, { language });
  const imageUrl = language === 'Hindi' ? design.images.hi : design.images.en;
  console.log('[edit:local] resolved image', { imageId: image.id, language, imageUrl });

  const progress = toHindi
    ? ['🌸 Translating your banner to Hindi…', '✍️ Re-rendering with the Hindi text…']
    : ['✍️ Updating your creative…'];
  await streamProgress(sendText, phoneNumber, progress);

  const summary = toHindi
    ? '🌸 Here you go — your banner is now in Hindi!'
    : "✅ Done — here's your updated banner.";
  const caption = `${summary}\n\nAnything else you'd like to change?`;

  try {
    await sendImage(phoneNumber, imageUrl, caption);
  } catch (err) {
    console.error('[localFlow.editGraphic] sendImage error', { imageId: image.id, message: err.message });
    return `I updated "${image.name}", but couldn't send the image right now — try asking me to resend it.`;
  }

  return { skipSend: true, historyText: caption };
}

// What can be edited? — from the design's static slot schema (no API).
function checkAllowedEdits(image) {
  const elements = localEditElements(image);
  return {
    type: 'edit_options',
    bodyText: 'What would you like to change?',
    options: buildEditOptions(elements, image.id),
    historyText: formatAllowedEdits(image.name, elements),
  };
}

module.exports = { createDesign, editGraphic, checkAllowedEdits, getOfferContext };
