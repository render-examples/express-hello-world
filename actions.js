const { getTrackedImages, findTrackedImage } = require('./imageStore');
const { getTemplateInfo, applyEdit } = require('./expressApi');
const { uploadImageToMeta } = require('./metaUpload');

function formatUnknownImageMessage(phoneNumber) {
  const images = getTrackedImages(phoneNumber);
  const list = images.map((image) => `- ${image.name}`).join('\n');
  return `I couldn't find that image. Here's what I have:\n${list}`;
}

async function actionListCampaignGraphics() {
  // TODO: fetch from campaign API
  return 'Graphics in your current campaign:\n1. Diwali Offer Banner\n2. Summer Sale Flyer\n3. Croma Earbuds';
}

async function actionCheckAllowedEdits(phoneNumber, imageId) {
  const image = findTrackedImage(phoneNumber, imageId);
  if (!image) {
    return formatUnknownImageMessage(phoneNumber);
  }
  const { unlockedLayers } = getTemplateInfo(image.templateId);
  const layerList = unlockedLayers.map((layer) => `- ${layer}`).join('\n');
  return `Edits allowed on "${image.name}":\n${layerList}`;
}

async function actionEditGraphic(phoneNumber, imageId, edits, { sendImage }) {
  const image = findTrackedImage(phoneNumber, imageId);
  if (!image) {
    return formatUnknownImageMessage(phoneNumber);
  }

  const { unlockedLayers } = getTemplateInfo(image.templateId);
  const requestedKeys = Object.keys(edits || {});
  const disallowedKeys = requestedKeys.filter((key) => !unlockedLayers.includes(key));

  if (disallowedKeys.length > 0) {
    const allowedList = unlockedLayers.map((layer) => `- ${layer}`).join('\n');
    return `I can't edit ${disallowedKeys.join(', ')} on "${image.name}". Allowed edits:\n${allowedList}`;
  }

  const { mergedEdits, renderedImageUrl } = applyEdit(image.templateId, image.currentEdits, edits);
  image.currentEdits = mergedEdits;

  const uploadedUrl = await uploadImageToMeta(renderedImageUrl);
  await sendImage(phoneNumber, uploadedUrl);

  const summary = Object.entries(edits).map(([key, value]) => `• ${key}: ${value}`).join('\n');
  return `Updated "${image.name}":\n${summary}`;
}

async function actionGenerateBulkGraphics(filename) {
  // TODO: parse CSV/Excel and call Adobe Express API per row
  return `Bulk generation complete! Graphics created from ${filename || 'your uploaded file'}.`;
}

module.exports = {
  actionListCampaignGraphics,
  actionCheckAllowedEdits,
  actionEditGraphic,
  actionGenerateBulkGraphics,
};
