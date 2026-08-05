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

// Brand-new designs created at runtime via create_design, keyed by phone number.
// These are `source: 'local'` (canned images) as opposed to the `source: 'express'`
// catalog entries which are backed by the real Adobe Express API.
const createdDesigns = new Map();

function createDesign(phoneNumber, design) {
  const list = createdDesigns.get(phoneNumber) || [];
  const id = `local_${list.length + 1}`;
  const entry = { id, source: 'local', ...design };
  list.push(entry);
  createdDesigns.set(phoneNumber, list);
  return entry;
}

function getTrackedImages(phoneNumber) {
  const catalog = loadCatalog().map((entry) => ({ ...entry, source: 'express' }));
  const created = createdDesigns.get(phoneNumber) || [];
  return [...catalog, ...created].map((entry) => ({
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

module.exports = { getTrackedImages, findTrackedImage, recordEdits, createDesign };
