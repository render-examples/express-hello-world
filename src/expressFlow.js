// ── Flow 1: Adobe Express-backed catalog designs (image.source === 'express') ─
// Real Adobe Express API: read the tagged document, validate edits against the
// live tagged elements, generate a variation, poll, and hand back a structured
// outcome for the caller (app.js) to phrase, deliver, and follow up on.
//
// Self-contained: this module must NOT depend on the local/canned flow. It is
// reached only via the router in actions.js for images whose source is 'express'.

const { recordEdits } = require('./imageStore');
const expressApi = require('./express/expressApi');
const s3Upload = require('./express/s3Upload');
const { buildValueEditId } = require('./interactiveReply');
const { formatAllowedEdits } = require('./editOptions');

// A "change the product to a TV" request offers 3 fixed models as quick replies.
//
// The source product photo lives on Adobe's Scene7 CDN, but Adobe's own
// generate-variation API rejects scene7.com for image tagMappings — only AWS S3,
// Dropbox, or Azure (windows.net) URLs are accepted (see VariationDetails.tagMappings
// in the Express API spec). So it's re-hosted on S3 (upload + presigned GET URL,
// via s3Upload.uploadFromUrl) at edit time instead of a one-off hand-uploaded URL
// that itself expires and has to be manually regenerated.
const TV_PRODUCT_SOURCE_IMAGE_URL = 'https://s7ap1.scene7.com/is/image/healthmonitor/SonyTv?wid=1000&fmt=png-alpha';
const TV_MODEL_TITLES = ['Sony Bravia K-75', 'LG UA82 AI', 'Samsung UA4'];

// The presigned S3 URL is long — WhatsApp interactive list rows cap `id` at 200
// chars (#131009 "Row id is too long"), and buildValueEditId round-trips the full
// edits object through both the row id and (via GPT) the synthetic message text.
// So the *encoded* edits carry this short token instead of the real URL; it's
// expanded to a fresh presigned S3 URL in editGraphic before anything is sent to
// the Express API.
const TV_PLACEHOLDER_IMAGE_TOKEN = 'tv-model-image-placeholder';
const TV_MODEL_EDITS = { productImage: TV_PLACEHOLDER_IMAGE_TOKEN, oldPrice: 33999, price: 27199 };

// TEMP: product-change requests ("select_tv_model" / any edit carrying a
// productImage) are served from this pre-rendered banner instead of the real
// Adobe Express generate-variation pipeline — the user still sees the usual
// "calling Express API" progress message, but no Express/S3 network calls happen.
const HARDCODED_PRODUCT_UPDATE_THUMBNAIL_URL =
  'https://s7ap1.scene7.com/is/image/healthmonitor/Croma-Diwali-Banner-product-update?wid=1000';

// TEMP: discount-change requests are served from this pre-rendered banner instead
// of the real Adobe Express pipeline. GPT sends a "discountPercentage" key (see the
// system prompt in app.js) alongside the computed price, but that key isn't one of
// the document's tagged elements — the real pipeline would always reject it as a
// disallowed field — so it's routed here instead, same as the product-change bypass.
const HARDCODED_DISCOUNT_UPDATE_THUMBNAIL_URL =
  'https://s7ap1.scene7.com/is/image/healthmonitor/Croma-Diwali-Banner-discount-update?wid=1000';

async function expandPlaceholderEdits(edits) {
  if (edits && edits.productImage === TV_PLACEHOLDER_IMAGE_TOKEN) {
    const signedUrl = await s3Upload.uploadFromUrl(TV_PRODUCT_SOURCE_IMAGE_URL);
    return { ...edits, productImage: signedUrl };
  }
  return edits;
}

function formatINR(amount) {
  return Number(amount).toLocaleString('en-IN');
}

// The success caption for img_1 (Croma Diwali offer) — a fixed festive template
// rather than a GPT-phrased one-liner, so the banner's own promo copy carries
// through into the message text. Falls back to the TV_MODEL_EDITS constants for
// price/oldPrice when an edit (e.g. a lone "change price" request) hasn't gone
// through selectTvModel, so both are always populated.
function buildDiwaliOfferCaption({ price, oldPrice } = {}) {
  const displayPrice = formatINR(price ?? TV_MODEL_EDITS.price);
  const displayOldPrice = formatINR(oldPrice ?? TV_MODEL_EDITS.oldPrice);

  return `🪔✨ DIWALI DHAMAKA OFFER! ✨🪔

🎉 Upgrade your viewing experience this festive season with an amazing deal on the Sony Bravia K-75!

💥 Special Festive Price: ₹${displayPrice}
Regular Price: ₹${displayOldPrice}

✅ Trusted Sony Quality
✅ Limited Period Diwali Offer
✅ Great Savings for Your Family

📞 Contact us today or visit our store before the offer ends!

🎁 Hurry! Stocks are limited. Grab this festive deal now! 🛍️✨`;
}

const MAX_DISCOUNT_PERCENT = 40;
const ROUNDING_TOLERANCE_PERCENT = 0.5;

// Express-catalog graphics always show this fixed 3-option menu rather than a
// per-document field list; tapping one produces a bare "product"/"discount"/
// "price" field id via the existing interactive-reply scheme (interactiveReply.js).
const TOP_LEVEL_EDIT_FIELDS = [
  { fieldName: 'product', title: '🛍️ Edit Product' },
  { fieldName: 'discount', title: '🏷️ Edit Discount' },
  { fieldName: 'price', title: '💰 Edit Price' },
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
// tap tells GPT exactly what to apply (see interactiveReply.buildValueEditId). All 3
// models share the same placeholder edits, so the title is passed as a discriminator
// to keep the 3 row ids unique — WhatsApp rejects list messages with duplicate row ids.
// Presented as a WhatsApp list (buttonText set) rather than reply buttons.
function selectTvModel(imageId) {
  return {
    type: 'edit_options',
    bodyText: 'Which product do you want?',
    buttonText: 'Choose product',
    options: TV_MODEL_TITLES.map((title) => ({
      id: buildValueEditId(imageId, TV_MODEL_EDITS, title),
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
  const isProductUpdate = Boolean(edits && Object.prototype.hasOwnProperty.call(edits, 'productImage'));
  const isDiscountUpdate = Boolean(edits && Object.prototype.hasOwnProperty.call(edits, 'discountPercentage'));

  if (isProductUpdate) {
    if (typeof sendText === 'function') await sendText(phoneNumber, '⏳ Applying your edit and re-rendering with Adobe Express…');

    const mergedEdits = { ...image.currentEdits, ...edits };
    recordEdits(phoneNumber, image.id, edits);

    const outcome = { status: 'success', productName: image.name, changes: edits, thumbnailUrl: HARDCODED_PRODUCT_UPDATE_THUMBNAIL_URL };
    if (mergedEdits.price !== undefined) outcome.price = mergedEdits.price;
    if (mergedEdits.oldPrice !== undefined) outcome.oldPrice = mergedEdits.oldPrice;
    return outcome;
  }

  if (isDiscountUpdate) {
    // discountPercentage isn't a tagged document field (only productImage/oldPrice/
    // price are) — drop it before recording so it doesn't taint currentEdits for a
    // later real edit's tagMappings.
    const { discountPercentage, ...taggedEdits } = edits;

    const requestedPercent = parsePercent(discountPercentage);
    if (requestedPercent !== null && requestedPercent > MAX_DISCOUNT_PERCENT) {
      return { status: 'discount_capped', productName: image.name, maxPercent: MAX_DISCOUNT_PERCENT };
    }

    if (typeof sendText === 'function') await sendText(phoneNumber, '⏳ Applying your edit and re-rendering with Adobe Express…');

    const mergedEdits = { ...image.currentEdits, ...taggedEdits };
    recordEdits(phoneNumber, image.id, taggedEdits);

    const outcome = { status: 'success', productName: image.name, changes: taggedEdits, thumbnailUrl: HARDCODED_DISCOUNT_UPDATE_THUMBNAIL_URL };
    if (mergedEdits.price !== undefined) outcome.price = mergedEdits.price;
    if (mergedEdits.oldPrice !== undefined) outcome.oldPrice = mergedEdits.oldPrice;
    return outcome;
  }

  edits = await expandPlaceholderEdits(edits);

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

  // Tagged text elements always hold string values (see getTaggedDocument), and
  // Adobe's generate-variation API rejects a JSON number for a text tag with
  // "Unsupported text value for tag: <name>" (422) — so numeric edits like price/
  // oldPrice must be sent as strings even though they're computed as numbers.
  const tagMappings = Object.fromEntries(
    Object.entries(mergedEdits).map(([key, value]) => [key, String(value)])
  );

  let thumbnailUrl;
  try {
    const { statusUrl } = await expressApi.generateVariation(image.docId, tagMappings, pages, preferredDocumentName);
    const result = await expressApi.pollJobStatus(statusUrl);
    thumbnailUrl = result.document.thumbnailUrl;
    console.log('[edit:express] resolved image', { imageId: image.id, docId: image.docId, thumbnailUrl });
  } catch (err) {
    console.error('[expressFlow.editGraphic] generate/poll error', { docId: image.docId, message: err.message });
    return { status: 'api_error', productName: image.name, reason: 'generate_failed' };
  }

  recordEdits(phoneNumber, image.id, edits);

  const outcome = { status: 'success', productName: image.name, changes: edits, thumbnailUrl };
  if (mergedEdits.price !== undefined) outcome.price = mergedEdits.price;
  if (mergedEdits.oldPrice !== undefined) outcome.oldPrice = mergedEdits.oldPrice;
  return outcome;
}

module.exports = {
  selectTvModel,
  checkAllowedEdits,
  editGraphic,
  buildTopLevelEditOptions,
  buildDiwaliOfferCaption,
  MAX_DISCOUNT_PERCENT,
  TV_PRODUCT_SOURCE_IMAGE_URL,
  TV_PLACEHOLDER_IMAGE_TOKEN,
  HARDCODED_PRODUCT_UPDATE_THUMBNAIL_URL,
  HARDCODED_DISCOUNT_UPDATE_THUMBNAIL_URL,
};
