// ── Flow 2: canned-image designs created at runtime (image.source === 'local') ─
// No Adobe Express calls. A design is created from a text description and its
// edits resolve to pre-hosted image URLs defined in data/onam-design.json.
//
// Self-contained: this module must NOT depend on the express flow. It is reached
// only via the router in actions.js for images whose source is 'local'.

const fs = require('node:fs');
const path = require('node:path');
const { recordEdits, createDesign: registerDesign } = require('./imageStore');
const { buildEditOptions, formatAllowedEdits } = require('./editOptions');

function loadOnamDesign() {
  const filePath = process.env.ONAM_DESIGN_FILE || path.join(__dirname, '..', 'data', 'onam-design.json');
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Send progress ("streaming") messages one at a time with a pause between them,
// so generation feels like real work rather than an instant response. No-op when
// no sender is provided (keeps unit tests fast). Delay is tunable for the demo.
async function streamProgress(sendText, phoneNumber, messages) {
  if (typeof sendText !== 'function') return;
  const delay = Number(process.env.GEN_STEP_DELAY_MS ?? 1800);
  for (const message of messages) {
    await sendText(phoneNumber, message);
    await sleep(delay);
  }
}

// create_design: register a brand-new local design and send its image with a
// friendly caption. If the user opted to include their address, the creative
// that carries it is the "final" image (we only ship 2 canned URLs for this flow).
async function createDesign(phoneNumber, { occasion, products, offer, includeAddress } = {}, { sendImage, sendText }) {
  const design = loadOnamDesign();
  const productList = Array.isArray(products) && products.length ? products.join(' + ') : (products || 'your products');
  const festive = occasion || 'Festive';
  const name = [festive, productList, 'offer'].filter(Boolean).join(' ');
  const image = registerDesign(phoneNumber, { name, design });

  const imageUrl = includeAddress ? design.images.final : design.images.base;
  if (includeAddress) recordEdits(phoneNumber, image.id, { address: 'your store' });

  console.log('[action:create_design]', { phoneNumber, occasion, products, offer, includeAddress, image: imageUrl });

  // Stream the "work being done" so generation feels real, then send the image.
  const steps = [
    `🎨 Got it — creating your ${festive} creative now. Give me a few seconds…`,
    `📦 Pulling Croma's logo and the approved ${festive} colour palette from the brand kit…`,
    `📱 Adding your products: ${productList}…`,
    `🏷️ Applying ${offer ? `your ${offer} offer` : 'your offer'} and festive ${festive} styling…`,
  ];
  if (includeAddress) steps.push('📍 Placing your store address…');
  await streamProgress(sendText, phoneNumber, steps);

  const offerText = offer ? ` at ${offer}` : '';
  const addressText = includeAddress ? ', with your store address' : '';
  // The follow-up prompt lives inside the caption so it never arrives before the
  // image — WhatsApp delivers link images a beat after plain text.
  const caption = `🌼 Happy ${festive}! Here's your festive creative — ${productList}${offerText}${addressText}. On-brand with Croma's logo and approved colours, ready to share. ✨\n\nWant to change anything? For example, I can translate the whole banner to Malayalam. 🌸`;

  try {
    await sendImage(phoneNumber, imageUrl, caption);
  } catch (err) {
    console.error('[localFlow.createDesign] sendImage error', { message: err.message });
    return `I built your ${festive} design, but couldn't send the image right now — try asking me to resend it.`;
  }

  return { skipSend: true, historyText: caption };
}

function normalizeKey(key) {
  return String(key).toLowerCase().trim().replace(/\s+/g, '_');
}

// Map GPT's free-form edit keys onto the design's canonical slot names via
// aliases, so "background_color" / "colour" / "heading" all resolve correctly.
function canonicalizeEdits(editableSlots, edits) {
  const canonical = {};
  const unknown = [];
  for (const [rawKey, value] of Object.entries(edits || {})) {
    const key = normalizeKey(rawKey);
    const slot = editableSlots.find(
      (s) => normalizeKey(s.name) === key || (s.aliases || []).some((a) => normalizeKey(a) === key)
    );
    if (slot) canonical[slot.name] = value;
    else unknown.push(rawKey);
  }
  return { canonical, unknown };
}

function isPaletteColor(design, value) {
  const v = String(value).trim().toLowerCase();
  return (design.palette || []).some((c) => c.name.toLowerCase() === v || c.hex.toLowerCase() === v);
}

function hasMalayalam(value) {
  return /[ഀ-ൿ]/.test(String(value));
}

function isMalayalamEdit(currentEdits) {
  return Object.entries(currentEdits).some(([key, value]) =>
    hasMalayalam(String(value)) || (key === 'language' && /malayalam/i.test(String(value)))
  );
}

// Pick the canned image for the current accumulated edit state.
function resolveLocalImage(design, currentEdits) {
  if (isMalayalamEdit(currentEdits)) return design.images.malayalam;
  if (currentEdits.background || currentEdits.address) return design.images.final;
  return design.images.base;
}

function localEditElements(image) {
  return image.design.slots.editable.map((slot) => ({
    name: slot.name,
    type: slot.type || 'text',
    value: image.currentEdits[slot.name] ?? '',
  }));
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

// Apply edits by resolving to the matching canned image URL.
async function editGraphic(phoneNumber, image, rawEdits, { sendImage, sendText }) {
  const design = image.design;
  const editableSlots = design.slots.editable;

  // Translation is special: the model may pass the Malayalam text (or the word
  // "Malayalam") under any key. Detect it up front so a "translate to Malayalam"
  // request always maps to the Malayalam creative, regardless of the edit key.
  const rawText = Object.entries(rawEdits || {}).flat().map(String);
  const wantsMalayalam = rawText.some(hasMalayalam) || rawText.some((s) => /malayalam/i.test(s));

  // A translation request short-circuits everything: map straight to the
  // Malayalam creative. Never treat it as a field edit or run it through the
  // palette / locked-field guardrails (the model may put the Malayalam text on
  // any key, including one that looks like "background").
  let appliedEdits;
  if (wantsMalayalam) {
    appliedEdits = { language: 'Malayalam' };
  } else {
    const { canonical: edits, unknown } = canonicalizeEdits(editableSlots, rawEdits);

    if (unknown.length > 0) {
      const editableNames = editableSlots.map((s) => s.name).join(', ');
      return `I can't edit ${unknown.join(', ')} on "${image.name}" — those are locked by HQ. You can change: ${editableNames}.`;
    }

    if ('background' in edits && !isPaletteColor(design, edits.background)) {
      const options = design.palette.map((c) => c.name).join(' · ');
      return `"${edits.background}" isn't in the approved palette 🙂 Here are the festive accents you can pick from: ${options}`;
    }

    appliedEdits = edits;
  }

  recordEdits(phoneNumber, image.id, appliedEdits);
  const currentEdits = { ...image.currentEdits, ...appliedEdits };
  const imageUrl = resolveLocalImage(design, currentEdits);
  console.log('[edit:local] resolved image', { imageId: image.id, currentEdits, imageUrl });

  // Stream progress so the re-render feels real, then send the updated image.
  const progress = wantsMalayalam
    ? ['🌸 Translating your banner to Malayalam…', '✍️ Re-rendering with the Malayalam text…']
    : ['✍️ Updating your creative…'];
  await streamProgress(sendText, phoneNumber, progress);

  const summary = wantsMalayalam
    ? '🌸 Here you go — your banner is now in Malayalam!'
    : `✅ Done! Updated ${Object.entries(appliedEdits).map(([key, value]) => `${key} → ${value}`).join(', ')}.`;
  // Follow-up lives in the caption so it can't arrive before the image.
  const caption = `${summary}\n\nAnything else you'd like to change?`;

  try {
    await sendImage(phoneNumber, imageUrl, caption);
  } catch (err) {
    console.error('[localFlow.editGraphic] sendImage error', { imageId: image.id, message: err.message });
    return `I updated "${image.name}", but couldn't send the image right now — try asking me to resend it.`;
  }

  return { skipSend: true, historyText: caption };
}

module.exports = { createDesign, checkAllowedEdits, editGraphic };
