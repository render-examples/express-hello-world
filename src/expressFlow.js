// ── Flow 1: Adobe Express-backed catalog designs (image.source === 'express') ─
// Real Adobe Express API: read the tagged document, validate edits against the
// live tagged elements, generate a variation, poll, and hand back a structured
// outcome for the caller (app.js) to phrase, deliver, and follow up on.
//
// Self-contained: this module must NOT depend on the local/canned flow. It is
// reached only via the router in actions.js for images whose source is 'express'.

const { recordEdits } = require('./imageStore');
const expressApi = require('./express/expressApi');
const { buildValueEditId } = require('./interactiveReply');
const { formatAllowedEdits } = require('./editOptions');

// A "change the product to a TV" request offers 3 fixed models as quick replies.
const TV_PLACEHOLDER_IMAGE_URL = 'https://s7ap1.scene7.com/is/image/healthmonitor/SonyTv?wid=1000';
const TV_MODEL_TITLES = ['Sony Bravia K-75', 'LG UA82 AI', 'Samsung UA4'];
const TV_MODEL_EDITS = { productImage: TV_PLACEHOLDER_IMAGE_URL, oldPrice: 33999, price: 27199 };

const MAX_DISCOUNT_PERCENT = 40;
const ROUNDING_TOLERANCE_PERCENT = 0.5;

// Express-catalog graphics always show this fixed 3-option menu rather than a
// per-document field list; tapping one produces a bare "product"/"discount"/
// "price" field id via the existing interactive-reply scheme (interactiveReply.js).
const TOP_LEVEL_EDIT_FIELDS = [
  { fieldName: 'product', title: 'Edit Product' },
  { fieldName: 'discount', title: 'Edit Discount' },
  { fieldName: 'price', title: 'Edit Price' },
];

function withCurrentEdits(elements, currentEdits) {
  return elements.map((element) =>
    element.name in currentEdits ? { ...element, value: currentEdits[element.name] } : element
  );
}

function isDiscountField(name) {
  return /discount/i.test(name);
}

function parsePercent(value) {
  const match = String(value).match(/(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : null;
}

function findOldPriceKey(keys) {
  return keys.find((key) => /^old.?price$/i.test(key));
}

function findNewPriceKey(keys, oldPriceKey) {
  return keys.find((key) => key !== oldPriceKey && /(^|_)price$/i.test(key));
}

// Covers both "discount ko 50% kar do" (GPT computes a price from oldPrice) and a
// direct "set price to X" request — either way, a price drop of more than the cap
// (plus rounding slack for whole-rupee prices) is rejected.
function impliesExcessiveDiscount(mergedEdits, requestedKeys) {
  const keys = Object.keys(mergedEdits);
  const oldPriceKey = findOldPriceKey(keys);
  const newPriceKey = findNewPriceKey(keys, oldPriceKey);
  if (!oldPriceKey || !newPriceKey || !requestedKeys.includes(newPriceKey)) return false;

  const oldPrice = Number(mergedEdits[oldPriceKey]);
  const newPrice = Number(mergedEdits[newPriceKey]);
  if (!Number.isFinite(oldPrice) || oldPrice <= 0 || !Number.isFinite(newPrice)) return false;

  const impliedDiscountPercent = ((oldPrice - newPrice) / oldPrice) * 100;
  return impliedDiscountPercent > MAX_DISCOUNT_PERCENT + ROUNDING_TOLERANCE_PERCENT;
}

// TV model picker — each option id encodes the full productImage/price edits so a
// tap tells GPT exactly what to apply (see interactiveReply.buildValueEditId).
// Presented as a WhatsApp list (buttonText set) rather than reply buttons.
function selectTvModel(imageId) {
  return {
    type: 'edit_options',
    bodyText: 'Which product do you want?',
    buttonText: 'Choose product',
    options: TV_MODEL_TITLES.map((title) => ({
      id: buildValueEditId(imageId, TV_MODEL_EDITS),
      title,
    })),
  };
}

function buildTopLevelEditOptions(imageId) {
  return {
    type: 'edit_options',
    bodyText: 'What would you like to change?',
    options: TOP_LEVEL_EDIT_FIELDS.map(({ fieldName, title }) => ({
      id: `edit:${imageId}:${fieldName}`,
      title,
    })),
    historyText: 'What would you like to change? (Edit Product / Edit Discount / Edit Price)',
  };
}

// What can be edited? — the menu is fixed and doesn't depend on document
// contents, so no Express API call is needed here.
async function checkAllowedEdits(image) {
  return buildTopLevelEditOptions(image.id);
}

// Apply edits via the real Adobe Express generate-variation pipeline. Returns a
// structured outcome — never sends the image itself — so the caller (app.js) can
// phrase the final reply (matching the user's language) and deliver the image
// with that phrasing as its caption in one message.
async function editGraphic(phoneNumber, image, edits, { sendText } = {}) {
  let elements;
  try {
    const doc = await expressApi.getTaggedDocument(image.docId);
    elements = expressApi.collectTaggedElements(doc);
  } catch (err) {
    console.error('[expressFlow.editGraphic] Express API error', { docId: image.docId, message: err.message });
    return { status: 'api_error', productName: image.name, reason: 'lookup_failed' };
  }

  const allowedNames = elements.map((element) => element.name);
  const requestedKeys = Object.keys(edits || {});
  const disallowedKeys = requestedKeys.filter((key) => !allowedNames.includes(key));

  if (disallowedKeys.length > 0) {
    const elementsWithCurrentEdits = withCurrentEdits(elements, image.currentEdits);
    return {
      status: 'disallowed_fields',
      productName: image.name,
      disallowedKeys,
      allowedSummary: formatAllowedEdits(image.name, elementsWithCurrentEdits),
    };
  }

  const oversizedDiscountKeys = requestedKeys.filter((key) => {
    if (!isDiscountField(key)) return false;
    const percent = parsePercent(edits[key]);
    return percent !== null && percent > MAX_DISCOUNT_PERCENT;
  });

  const mergedEdits = { ...image.currentEdits, ...edits };

  if (oversizedDiscountKeys.length > 0 || impliesExcessiveDiscount(mergedEdits, requestedKeys)) {
    return { status: 'discount_capped', productName: image.name, maxPercent: MAX_DISCOUNT_PERCENT };
  }

  if (typeof sendText === 'function') await sendText(phoneNumber, '⏳ Applying your edit and re-rendering with Adobe Express…');

  const pages = expressApi.pagesForEdits(elements, Object.keys(mergedEdits));
  const preferredDocumentName = expressApi.buildPreferredDocumentName(image.name);

  let thumbnailUrl;
  try {
    const { statusUrl } = await expressApi.generateVariation(image.docId, mergedEdits, pages, preferredDocumentName);
    const result = await expressApi.pollJobStatus(statusUrl);
    thumbnailUrl = result.document.thumbnailUrl;
    console.log('[edit:express] resolved image', { imageId: image.id, docId: image.docId, thumbnailUrl });
  } catch (err) {
    console.error('[expressFlow.editGraphic] generate/poll error', { docId: image.docId, message: err.message });
    return { status: 'api_error', productName: image.name, reason: 'generate_failed' };
  }

  recordEdits(phoneNumber, image.id, edits);

  return { status: 'success', productName: image.name, changes: edits, thumbnailUrl };
}

module.exports = {
  selectTvModel,
  checkAllowedEdits,
  editGraphic,
  buildTopLevelEditOptions,
  MAX_DISCOUNT_PERCENT,
};
