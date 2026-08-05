const fs = require('node:fs');
const path = require('node:path');

function catalogPath() {
  return process.env.EXPRESS_TEMPLATES_FILE || path.join(__dirname, '..', 'data', 'express-templates.json');
}

function loadCatalog() {
  try {
    const raw = fs.readFileSync(catalogPath(), 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      console.error('[imageStore] failed to read catalog', { path: catalogPath(), message: 'catalog is not an array' });
      return [];
    }
    return parsed;
  } catch (err) {
    console.error('[imageStore] failed to read catalog', { path: catalogPath(), message: err.message });
    return [];
  }
}

const conversationEdits = new Map();

function getTrackedImages(phoneNumber) {
  return loadCatalog().map((entry) => ({
    ...entry,
    currentEdits: conversationEdits.get(`${phoneNumber}:${entry.id}`) || {},
  }));
}

function findTrackedImage(phoneNumber, imageId) {
  return getTrackedImages(phoneNumber).find((image) => image.id === imageId);
}

function recordEdits(phoneNumber, imageId, newEdits) {
  const key = `${phoneNumber}:${imageId}`;
  const merged = { ...(conversationEdits.get(key) || {}), ...newEdits };
  conversationEdits.set(key, merged);
  return merged;
}

module.exports = { getTrackedImages, findTrackedImage, recordEdits };
