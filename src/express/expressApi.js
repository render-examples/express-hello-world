const { buildAuthHeaders } = require('./expressAuth');
// Presentation helpers live in a shared module; re-exported here for backward
// compatibility with existing callers/tests.
const { formatAllowedEdits, buildEditOptions } = require('../editOptions');

function apiBaseUrl() {
  return process.env.EXPRESS_API_BASE_URL || 'https://express-api.adobe.io';
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getTaggedDocument(docId) {
  const headers = await buildAuthHeaders();
  const response = await fetch(`${apiBaseUrl()}/beta/tagged-documents/${encodeURIComponent(docId)}`, { headers });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`getTaggedDocument failed ${response.status}: ${text}`);
  }
  return response.json();
}

async function generateVariation(docId, tagMappings, pages, preferredDocumentName) {
  const headers = await buildAuthHeaders();
  const response = await fetch(`${apiBaseUrl()}/beta/generate-variation`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: docId,
      variationDetails: { pages, preferredDocumentName, tagMappings },
    }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`generateVariation failed ${response.status}: ${text}`);
  }
  return response.json();
}

async function getJobStatus(statusUrl) {
  const headers = await buildAuthHeaders();
  const response = await fetch(statusUrl, { headers });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`getJobStatus failed ${response.status}: ${text}`);
  }
  return response.json();
}

async function pollJobStatus(statusUrl, { intervalMs, timeoutMs } = {}) {
  const interval = intervalMs ?? Number(process.env.EXPRESS_STATUS_POLL_INTERVAL_MS || 2000);
  const timeout = timeoutMs ?? Number(process.env.EXPRESS_STATUS_POLL_TIMEOUT_MS || 60000);
  const deadline = Date.now() + timeout;

  for (;;) {
    const result = await getJobStatus(statusUrl);
    if (result.status === 'succeeded') return result;
    if (result.status === 'failed') throw new Error(`Express job at ${statusUrl} failed`);
    if (Date.now() >= deadline) throw new Error(`Express job at ${statusUrl} timed out after ${timeout}ms`);
    await sleep(interval);
  }
}

function collectTaggedElements(taggedDocument) {
  const elements = [];
  for (const page of taggedDocument.documentPages || []) {
    for (const element of page.taggedElements || []) {
      elements.push({ ...element, pageNumber: page.pageNumber });
    }
  }
  return elements;
}

function pagesForEdits(elements, editKeys) {
  const pageNumbers = new Set(
    elements.filter((element) => editKeys.includes(element.name)).map((element) => element.pageNumber)
  );
  return [...pageNumbers].sort((a, b) => a - b).join(',');
}

function buildPreferredDocumentName(baseName) {
  return `${baseName}-edit-${Date.now()}`;
}

module.exports = {
  getTaggedDocument,
  generateVariation,
  getJobStatus,
  pollJobStatus,
  collectTaggedElements,
  formatAllowedEdits,
  buildEditOptions,
  pagesForEdits,
  buildPreferredDocumentName,
};
