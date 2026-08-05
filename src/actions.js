// Thin action layer for the GPT tools. The two edit flows live in their own
// self-contained modules and are dispatched deterministically by image.source:
//   source: 'express' → expressFlow  (real Adobe Express API — catalog designs)
//   source: 'local'   → localFlow    (canned image URLs — runtime-created designs)
// Keeping this file free of flow-specific logic means changing one flow can never
// affect the other.

const { getTrackedImages, findTrackedImage } = require('./imageStore');
const expressFlow = require('./expressFlow');
const localFlow = require('./localFlow');

function formatUnknownImageMessage(phoneNumber) {
  const images = getTrackedImages(phoneNumber);
  const list = images.map((image) => `- ${image.name}`).join('\n');
  return `I couldn't find that image. Here's what I have:\n${list}`;
}

async function actionListCampaignGraphics() {
  console.log('[action:list_campaign_graphics]');
  // TODO: fetch from campaign API
  return 'Graphics in your current campaign:\n1. Croma Earbuds';
}

// Flow 2 (local/canned) — create a brand-new design from a text description.
function actionCreateDesign(phoneNumber, args, ctx) {
  return localFlow.createDesign(phoneNumber, args, ctx);
}

// Flow 1 (express/catalog) — offer the fixed TV models as quick replies.
function actionSelectTvModel(imageId) {
  return expressFlow.selectTvModel(imageId);
}

// Flow 1 (express/catalog) — the fixed Edit Product/Discount/Price menu, reused
// by app.js to resurface the menu after every edit outcome on this flow.
function buildTopLevelEditOptions(imageId) {
  return expressFlow.buildTopLevelEditOptions(imageId);
}

// Flow 1 (express/catalog) — the fixed Diwali-offer caption used as the image
// message text after a successful edit_graphic on img_1.
function buildDiwaliOfferCaption(result) {
  return expressFlow.buildDiwaliOfferCaption(result);
}

// Flow 2 (local) — approved plans + governance for the GPT system prompt.
function getOfferContext() {
  return localFlow.getOfferContext();
}

// Router: resolve the image, then hand off to the flow that owns it.
async function actionCheckAllowedEdits(phoneNumber, imageId) {
  const image = findTrackedImage(phoneNumber, imageId);
  console.log('[action:check_allowed_edits]', { phoneNumber, imageId, source: image?.source ?? 'not_found' });
  if (!image) return formatUnknownImageMessage(phoneNumber);

  return image.source === 'local'
    ? localFlow.checkAllowedEdits(image)
    : expressFlow.checkAllowedEdits(image);
}

// Router: resolve the image, then hand off to the flow that owns it.
async function actionEditGraphic(phoneNumber, imageId, edits, { sendImage, sendText }) {
  const image = findTrackedImage(phoneNumber, imageId);
  console.log('[action:edit_graphic]', { phoneNumber, imageId, source: image?.source ?? 'not_found', edits });
  if (!image) return formatUnknownImageMessage(phoneNumber);

  return image.source === 'local'
    ? localFlow.editGraphic(phoneNumber, image, edits, { sendImage, sendText })
    : expressFlow.editGraphic(phoneNumber, image, edits, { sendImage, sendText });
}

async function actionGenerateBulkGraphics(filename) {
  console.log('[action:generate_bulk_graphics]', { filename });
  // TODO: parse CSV/Excel and call Adobe Express API per row
  return `Bulk generation complete! Graphics created from ${filename || 'your uploaded file'}.`;
}

module.exports = {
  actionListCampaignGraphics,
  actionCreateDesign,
  actionCheckAllowedEdits,
  actionEditGraphic,
  actionGenerateBulkGraphics,
  actionSelectTvModel,
  buildTopLevelEditOptions,
  buildDiwaliOfferCaption,
  getOfferContext,
};
