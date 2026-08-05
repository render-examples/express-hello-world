# Real Adobe Express API Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace every mocked/hardcoded piece of the image-edit flow with real Adobe Express API calls (`tagged-documents`, `generate-variation`, `status`), driven by a shared `docId` catalog, ending with the real edited-image `thumbnailUrl` sent back over WhatsApp.

**Architecture:** A new `expressAuth.js` handles IMS OAuth token fetch/cache. `expressApi.js` is rewritten to make real HTTP calls (tagged-document lookup, variation generation, status polling) plus small formatting/helper functions, using `expressAuth.js` for auth headers. `imageStore.js` is rewritten to read a shared JSON catalog (`data/express-templates.json`, `id`/`name`/`docId`) fresh on every call instead of hardcoded seed data, layering in-memory per-conversation edit state on top. `actions.js` is rewired to call the real `expressApi.js` functions (via a namespace import so tests can stub them directly) instead of the old mocks, with all Express API failures caught and turned into friendly WhatsApp replies. `app.js` gets a few extra labeled `console.log` lines for webhook fields that might carry docID metadata — no other behavior change. `metaUpload.js` is left completely untouched and unused.

**Tech Stack:** Node.js 20, Express 5, `openai` SDK, Node's built-in `node:test` + `node:assert/strict` + global `fetch` (no new dependencies).

## Global Constraints

- No new npm dependencies — use Node's built-in `node:test` test runner and global `fetch`, stubbed directly in tests (no mocking library).
- Follow existing code style: CommonJS `require`, 2-space indentation, semicolons.
- Real Adobe Express HTTP errors must never reach the WhatsApp user raw — every call site catches and replaces them with a short friendly retry message, logging the technical detail (status/body/docId/jobId) server-side via `console.error`.
- `data/express-templates.json` is committed to git (not gitignored) and is a flat, phone-number-agnostic catalog: `[{ id, name, docId }]`. No per-phone-number entries.
- IMS token responses' `expires_in` is treated as **milliseconds** (Adobe IMS v3 convention), added directly to `Date.now()` — flagged as an assumption to verify against the real endpoint; isolated to one line in `expressAuth.js` if it needs to change to `* 1000`.
- `metaUpload.js` and `metaUpload.test.js` stay in the repo, completely unmodified, and are not imported anywhere after this change.
- A failed or timed-out edit must not be recorded into the per-conversation edit state — only a successful `generate-variation` + `status: succeeded` commits the edit, so retries don't compound bad state.

---

## Task 1: `expressAuth.js` — IMS token fetch/cache

**Files:**
- Create: `expressAuth.js`
- Test: `expressAuth.test.js`

**Interfaces:**
- Consumes: env vars `EXPRESS_CLIENT_ID`, `EXPRESS_CLIENT_SECRET`, `EXPRESS_API_SCOPE` (optional), `EXPRESS_IMS_TOKEN_URL` (optional).
- Produces: `getAccessToken() -> Promise<string>` (cached IMS access token, refetches within 60s of expiry). `buildAuthHeaders() -> Promise<{ Authorization: string, 'X-API-KEY': string }>`.

- [ ] **Step 1: Write the failing tests**

Create `expressAuth.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');

const originalFetch = global.fetch;

function freshExpressAuth() {
  delete require.cache[require.resolve('./expressAuth')];
  return require('./expressAuth');
}

test('getAccessToken fetches a token from the IMS endpoint using client credentials', async () => {
  process.env.EXPRESS_CLIENT_ID = 'client-123';
  process.env.EXPRESS_CLIENT_SECRET = 'secret-456';
  global.fetch = async (url, options) => {
    assert.equal(url, 'https://ims-na1.adobelogin.com/ims/token/v3');
    assert.equal(options.method, 'POST');
    assert.equal(options.headers['Content-Type'], 'application/x-www-form-urlencoded');
    const body = options.body.toString();
    assert.match(body, /grant_type=client_credentials/);
    assert.match(body, /client_id=client-123/);
    assert.match(body, /client_secret=secret-456/);
    return { ok: true, json: async () => ({ access_token: 'tok-abc', expires_in: 86400000, token_type: 'bearer' }) };
  };

  const { getAccessToken } = freshExpressAuth();
  const token = await getAccessToken();

  assert.equal(token, 'tok-abc');
  global.fetch = originalFetch;
});

test('getAccessToken caches the token and does not refetch on a second call', async () => {
  process.env.EXPRESS_CLIENT_ID = 'client-123';
  process.env.EXPRESS_CLIENT_SECRET = 'secret-456';
  let fetchCalls = 0;
  global.fetch = async () => {
    fetchCalls += 1;
    return { ok: true, json: async () => ({ access_token: 'tok-cached', expires_in: 86400000 }) };
  };

  const { getAccessToken } = freshExpressAuth();
  const first = await getAccessToken();
  const second = await getAccessToken();

  assert.equal(first, 'tok-cached');
  assert.equal(second, 'tok-cached');
  assert.equal(fetchCalls, 1);
  global.fetch = originalFetch;
});

test('getAccessToken refetches once the cached token is within 60s of expiring', async () => {
  process.env.EXPRESS_CLIENT_ID = 'client-123';
  process.env.EXPRESS_CLIENT_SECRET = 'secret-456';
  let fetchCalls = 0;
  global.fetch = async () => {
    fetchCalls += 1;
    return { ok: true, json: async () => ({ access_token: `tok-${fetchCalls}`, expires_in: 30000 }) };
  };

  const { getAccessToken } = freshExpressAuth();
  const first = await getAccessToken();
  const second = await getAccessToken();

  assert.equal(first, 'tok-1');
  assert.equal(second, 'tok-2');
  assert.equal(fetchCalls, 2);
  global.fetch = originalFetch;
});

test('getAccessToken throws with the status and body when the IMS endpoint errors', async () => {
  process.env.EXPRESS_CLIENT_ID = 'client-123';
  process.env.EXPRESS_CLIENT_SECRET = 'secret-456';
  global.fetch = async () => ({ ok: false, status: 401, text: async () => 'invalid client' });

  const { getAccessToken } = freshExpressAuth();
  await assert.rejects(() => getAccessToken(), /401/);
  global.fetch = originalFetch;
});

test('buildAuthHeaders returns Authorization and X-API-KEY headers', async () => {
  process.env.EXPRESS_CLIENT_ID = 'client-789';
  process.env.EXPRESS_CLIENT_SECRET = 'secret-000';
  global.fetch = async () => ({ ok: true, json: async () => ({ access_token: 'tok-xyz', expires_in: 86400000 }) });

  const { buildAuthHeaders } = freshExpressAuth();
  const headers = await buildAuthHeaders();

  assert.deepEqual(headers, { Authorization: 'Bearer tok-xyz', 'X-API-KEY': 'client-789' });
  global.fetch = originalFetch;
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test expressAuth.test.js`
Expected: FAIL — `Cannot find module './expressAuth'`

- [ ] **Step 3: Write the implementation**

Create `expressAuth.js`:

```js
const IMS_TOKEN_URL = process.env.EXPRESS_IMS_TOKEN_URL || 'https://ims-na1.adobelogin.com/ims/token/v3';
const DEFAULT_SCOPE = 'ee.express_api,openid,AdobeID,read_organizations,additional_info.projectedProductContext';
const REFRESH_MARGIN_MS = 60_000;

let cachedToken = null; // { accessToken, expiresAt }

async function getAccessToken() {
  if (cachedToken && cachedToken.expiresAt - Date.now() > REFRESH_MARGIN_MS) {
    return cachedToken.accessToken;
  }

  const response = await fetch(IMS_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: process.env.EXPRESS_CLIENT_ID,
      client_secret: process.env.EXPRESS_CLIENT_SECRET,
      scope: process.env.EXPRESS_API_SCOPE || DEFAULT_SCOPE,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`IMS token request failed ${response.status}: ${text}`);
  }

  const data = await response.json();
  cachedToken = {
    accessToken: data.access_token,
    expiresAt: Date.now() + Number(data.expires_in),
  };
  return cachedToken.accessToken;
}

async function buildAuthHeaders() {
  const token = await getAccessToken();
  return {
    Authorization: `Bearer ${token}`,
    'X-API-KEY': process.env.EXPRESS_CLIENT_ID,
  };
}

module.exports = { getAccessToken, buildAuthHeaders };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test expressAuth.test.js`
Expected: PASS — 5 tests passing

- [ ] **Step 5: Commit**

```bash
git add expressAuth.js expressAuth.test.js
git commit -m "feat: add Adobe IMS token fetch/cache module"
```

---

## Task 2: `imageStore.js` — real catalog-backed image store

**Files:**
- Create: `data/express-templates.json`
- Modify: `imageStore.js` (full rewrite)
- Modify: `imageStore.test.js` (full rewrite)

**Interfaces:**
- Consumes: env var `EXPRESS_TEMPLATES_FILE` (optional, defaults to `data/express-templates.json` relative to this file).
- Produces: `getTrackedImages(phoneNumber) -> Array<{ id, name, docId, currentEdits }>`, `findTrackedImage(phoneNumber, imageId) -> object | undefined`, `recordEdits(phoneNumber, imageId, newEdits) -> object` (merges and returns the new `currentEdits`).

- [ ] **Step 1: Write the failing tests**

Create `imageStore.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { getTrackedImages, findTrackedImage, recordEdits } = require('./imageStore');

function writeFixtureCatalog(entries) {
  const fixturePath = path.join(os.tmpdir(), `express-templates-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  fs.writeFileSync(fixturePath, JSON.stringify(entries));
  process.env.EXPRESS_TEMPLATES_FILE = fixturePath;
}

test('getTrackedImages reads the catalog from EXPRESS_TEMPLATES_FILE', () => {
  writeFixtureCatalog([
    { id: 'img_1', name: 'Diwali Offer Banner', docId: 'urn:doc:1' },
    { id: 'img_2', name: 'Summer Sale Flyer', docId: 'urn:doc:2' },
  ]);

  const images = getTrackedImages('phone-1');

  assert.equal(images.length, 2);
  assert.deepEqual(images[0], { id: 'img_1', name: 'Diwali Offer Banner', docId: 'urn:doc:1', currentEdits: {} });
});

test('getTrackedImages returns an empty list when the catalog file is missing', () => {
  process.env.EXPRESS_TEMPLATES_FILE = path.join(os.tmpdir(), 'does-not-exist.json');

  const images = getTrackedImages('phone-2');

  assert.deepEqual(images, []);
});

test('findTrackedImage returns the matching image by id', () => {
  writeFixtureCatalog([{ id: 'img_3', name: 'Croma Earbuds', docId: 'urn:doc:3' }]);

  const image = findTrackedImage('phone-3', 'img_3');

  assert.equal(image.name, 'Croma Earbuds');
});

test('findTrackedImage returns undefined for an unknown id', () => {
  writeFixtureCatalog([{ id: 'img_3', name: 'Croma Earbuds', docId: 'urn:doc:3' }]);

  const image = findTrackedImage('phone-4', 'img_nope');

  assert.equal(image, undefined);
});

test('recordEdits merges edits per phone number and image id, visible via findTrackedImage', () => {
  writeFixtureCatalog([{ id: 'img_1', name: 'Diwali Offer Banner', docId: 'urn:doc:1' }]);

  recordEdits('phone-5', 'img_1', { headline: 'Flash Sale' });
  recordEdits('phone-5', 'img_1', { discount_text: '70%' });

  const image = findTrackedImage('phone-5', 'img_1');
  assert.deepEqual(image.currentEdits, { headline: 'Flash Sale', discount_text: '70%' });
});

test('recordEdits keeps edits independent per phone number', () => {
  writeFixtureCatalog([{ id: 'img_1', name: 'Diwali Offer Banner', docId: 'urn:doc:1' }]);

  recordEdits('phone-6', 'img_1', { headline: 'Only for phone-6' });

  const otherPhoneImage = findTrackedImage('phone-7', 'img_1');
  assert.deepEqual(otherPhoneImage.currentEdits, {});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test imageStore.test.js`
Expected: FAIL — assertions fail against the old hardcoded `SEED_IMAGES` behavior (module exists but returns the wrong shape/values)

- [ ] **Step 3: Write the implementation**

Replace the contents of `imageStore.js`:

```js
const fs = require('node:fs');
const path = require('node:path');

function catalogPath() {
  return process.env.EXPRESS_TEMPLATES_FILE || path.join(__dirname, 'data', 'express-templates.json');
}

function loadCatalog() {
  try {
    const raw = fs.readFileSync(catalogPath(), 'utf8');
    return JSON.parse(raw);
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
```

- [ ] **Step 4: Create the real catalog file**

Create `data/express-templates.json` with the one confirmed real entry (the Diwali/Summer entries from the old mock had no real Express document behind them, so they're not carried forward as fake data — add more entries here once the UI app provides their real `docId`s):

```json
[
  { "id": "img_1", "name": "Croma Earbuds", "docId": "urn:aaid:sc:AP:aaed427c-b4e4-55e4-b924-74d375f91684" }
]
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --test imageStore.test.js`
Expected: PASS — 6 tests passing

- [ ] **Step 6: Commit**

```bash
git add imageStore.js imageStore.test.js data/express-templates.json
git commit -m "feat: read the shared docID catalog instead of hardcoded seed images"
```

---

## Task 3: `expressApi.js` — real Adobe Express HTTP calls

**Files:**
- Modify: `expressApi.js` (full rewrite)
- Modify: `expressApi.test.js` (full rewrite)

**Interfaces:**
- Consumes: `buildAuthHeaders` from `./expressAuth` (Task 1); env vars `EXPRESS_API_BASE_URL`, `EXPRESS_STATUS_POLL_INTERVAL_MS`, `EXPRESS_STATUS_POLL_TIMEOUT_MS` (all optional).
- Produces: `getTaggedDocument(docId) -> Promise<object>`, `generateVariation(docId, tagMappings, pages, preferredDocumentName) -> Promise<{ jobId, statusUrl }>`, `getJobStatus(jobId) -> Promise<object>`, `pollJobStatus(jobId, { intervalMs?, timeoutMs? }) -> Promise<object>`, `collectTaggedElements(taggedDocument) -> Array<{ name, type, value?, pageNumber }>`, `formatAllowedEdits(name, elements) -> string`, `pagesForEdits(elements, editKeys) -> string`, `buildPreferredDocumentName(baseName) -> string`.

- [ ] **Step 1: Write the failing tests**

Create `expressApi.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  getTaggedDocument,
  generateVariation,
  getJobStatus,
  pollJobStatus,
  collectTaggedElements,
  formatAllowedEdits,
  pagesForEdits,
  buildPreferredDocumentName,
} = require('./expressApi');

const originalFetch = global.fetch;

function stubFetch(handlers) {
  global.fetch = async (url, options) => {
    if (url.includes('ims-na1.adobelogin.com')) {
      return { ok: true, json: async () => ({ access_token: 'tok-test', expires_in: 86400000 }) };
    }
    for (const [pattern, handler] of handlers) {
      if (pattern.test(url)) return handler(url, options);
    }
    throw new Error(`Unexpected fetch call: ${url}`);
  };
}

test('getTaggedDocument fetches and returns the tagged document', async () => {
  process.env.EXPRESS_CLIENT_ID = 'client-1';
  process.env.EXPRESS_CLIENT_SECRET = 'secret-1';
  stubFetch([
    [/\/beta\/tagged-documents\//, async (url, options) => {
      assert.match(url, /\/beta\/tagged-documents\/urn%3Aaaid%3Asc%3AAP%3Aabc$/);
      assert.equal(options.headers.Authorization, 'Bearer tok-test');
      assert.equal(options.headers['X-API-KEY'], 'client-1');
      return { ok: true, json: async () => ({ name: 'Croma2-Doc', id: 'urn:aaid:sc:AP:abc', documentPages: [] }) };
    }],
  ]);

  const doc = await getTaggedDocument('urn:aaid:sc:AP:abc');

  assert.equal(doc.name, 'Croma2-Doc');
  global.fetch = originalFetch;
});

test('getTaggedDocument throws with the status and body on a non-ok response', async () => {
  process.env.EXPRESS_CLIENT_ID = 'client-1';
  process.env.EXPRESS_CLIENT_SECRET = 'secret-1';
  stubFetch([
    [/\/beta\/tagged-documents\//, async () => ({ ok: false, status: 404, text: async () => 'not found' })],
  ]);

  await assert.rejects(() => getTaggedDocument('urn:missing'), /404/);
  global.fetch = originalFetch;
});

test('generateVariation posts the right body and returns jobId/statusUrl', async () => {
  process.env.EXPRESS_CLIENT_ID = 'client-1';
  process.env.EXPRESS_CLIENT_SECRET = 'secret-1';
  stubFetch([
    [/\/beta\/generate-variation$/, async (url, options) => {
      assert.equal(options.method, 'POST');
      const body = JSON.parse(options.body);
      assert.deepEqual(body, {
        id: 'urn:doc:1',
        variationDetails: {
          pages: '1',
          preferredDocumentName: 'Croma Earbuds-edit-123',
          tagMappings: { cta: '20% off' },
        },
      });
      return { ok: true, json: async () => ({ jobId: 'job-1', statusUrl: 'https://express-api.adobe.io/status/job-1' }) };
    }],
  ]);

  const result = await generateVariation('urn:doc:1', { cta: '20% off' }, '1', 'Croma Earbuds-edit-123');

  assert.deepEqual(result, { jobId: 'job-1', statusUrl: 'https://express-api.adobe.io/status/job-1' });
  global.fetch = originalFetch;
});

test('getJobStatus returns the parsed status response', async () => {
  process.env.EXPRESS_CLIENT_ID = 'client-1';
  process.env.EXPRESS_CLIENT_SECRET = 'secret-1';
  stubFetch([
    [/\/status\//, async () => ({
      ok: true,
      json: async () => ({ jobId: 'job-1', status: 'succeeded', document: { name: 'GD2.express', id: 'urn:doc:2', thumbnailUrl: 'https://example.com/thumb.png' } }),
    })],
  ]);

  const result = await getJobStatus('job-1');

  assert.equal(result.status, 'succeeded');
  assert.equal(result.document.thumbnailUrl, 'https://example.com/thumb.png');
  global.fetch = originalFetch;
});

test('pollJobStatus resolves once status is succeeded', async () => {
  process.env.EXPRESS_CLIENT_ID = 'client-1';
  process.env.EXPRESS_CLIENT_SECRET = 'secret-1';
  let calls = 0;
  stubFetch([
    [/\/status\//, async () => {
      calls += 1;
      const status = calls < 2 ? 'running' : 'succeeded';
      return {
        ok: true,
        json: async () => ({
          jobId: 'job-2',
          status,
          document: status === 'succeeded' ? { thumbnailUrl: 'https://example.com/thumb2.png' } : undefined,
        }),
      };
    }],
  ]);

  const result = await pollJobStatus('job-2', { intervalMs: 1, timeoutMs: 1000 });

  assert.equal(result.status, 'succeeded');
  assert.equal(calls, 2);
  global.fetch = originalFetch;
});

test('pollJobStatus throws when status is failed', async () => {
  process.env.EXPRESS_CLIENT_ID = 'client-1';
  process.env.EXPRESS_CLIENT_SECRET = 'secret-1';
  stubFetch([
    [/\/status\//, async () => ({ ok: true, json: async () => ({ jobId: 'job-3', status: 'failed' }) })],
  ]);

  await assert.rejects(() => pollJobStatus('job-3', { intervalMs: 1, timeoutMs: 1000 }), /failed/);
  global.fetch = originalFetch;
});

test('pollJobStatus throws once the timeout elapses without succeeding', async () => {
  process.env.EXPRESS_CLIENT_ID = 'client-1';
  process.env.EXPRESS_CLIENT_SECRET = 'secret-1';
  stubFetch([
    [/\/status\//, async () => ({ ok: true, json: async () => ({ jobId: 'job-4', status: 'running' }) })],
  ]);

  await assert.rejects(() => pollJobStatus('job-4', { intervalMs: 5, timeoutMs: 20 }), /timed out/);
  global.fetch = originalFetch;
});

test('collectTaggedElements flattens taggedElements across all pages with pageNumber attached', () => {
  const doc = {
    documentPages: [
      { pageNumber: 1, taggedElements: [{ name: 'heading', type: 'text', value: 'Hi' }] },
      { pageNumber: 2, taggedElements: [{ name: 'footer', type: 'text', value: 'Bye' }] },
    ],
  };

  const elements = collectTaggedElements(doc);

  assert.deepEqual(elements, [
    { name: 'heading', type: 'text', value: 'Hi', pageNumber: 1 },
    { name: 'footer', type: 'text', value: 'Bye', pageNumber: 2 },
  ]);
});

test('formatAllowedEdits lists text elements with their current value and non-text elements with just their type', () => {
  const elements = [
    { name: 'heading', type: 'text', value: 'Hi', pageNumber: 1 },
    { name: 'logo', type: 'image', pageNumber: 1 },
  ];

  const message = formatAllowedEdits('Croma Earbuds', elements);

  assert.match(message, /Edits allowed on "Croma Earbuds":/);
  assert.match(message, /- heading: currently "Hi"/);
  assert.match(message, /- logo \(image\)/);
});

test('pagesForEdits returns the sorted, comma-joined page numbers containing the edited fields', () => {
  const elements = [
    { name: 'heading', pageNumber: 2 },
    { name: 'cta', pageNumber: 1 },
    { name: 'footer', pageNumber: 1 },
  ];

  assert.equal(pagesForEdits(elements, ['cta']), '1');
  assert.equal(pagesForEdits(elements, ['cta', 'heading']), '1,2');
});

test('buildPreferredDocumentName appends a timestamp suffix to the base name', () => {
  const name = buildPreferredDocumentName('Croma Earbuds');
  assert.match(name, /^Croma Earbuds-edit-\d+$/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test expressApi.test.js`
Expected: FAIL — old mocked `getTemplateInfo`/`applyEdit` exports don't match the new functions being imported

- [ ] **Step 3: Write the implementation**

Replace the contents of `expressApi.js`:

```js
const { buildAuthHeaders } = require('./expressAuth');

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

async function getJobStatus(jobId) {
  const headers = await buildAuthHeaders();
  const response = await fetch(`${apiBaseUrl()}/status/${encodeURIComponent(jobId)}`, { headers });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`getJobStatus failed ${response.status}: ${text}`);
  }
  return response.json();
}

async function pollJobStatus(jobId, { intervalMs, timeoutMs } = {}) {
  const interval = intervalMs ?? Number(process.env.EXPRESS_STATUS_POLL_INTERVAL_MS || 2000);
  const timeout = timeoutMs ?? Number(process.env.EXPRESS_STATUS_POLL_TIMEOUT_MS || 60000);
  const deadline = Date.now() + timeout;

  for (;;) {
    const result = await getJobStatus(jobId);
    if (result.status === 'succeeded') return result;
    if (result.status === 'failed') throw new Error(`Express job ${jobId} failed`);
    if (Date.now() >= deadline) throw new Error(`Express job ${jobId} timed out after ${timeout}ms`);
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

function formatAllowedEdits(name, elements) {
  const lines = elements.map((element) =>
    element.type === 'text'
      ? `- ${element.name}: currently "${element.value}"`
      : `- ${element.name} (${element.type})`
  );
  const example = elements[0]?.name || 'a field';
  return `Edits allowed on "${name}":\n${lines.join('\n')}\nTell me what you'd like to change and to what, e.g. "change ${example} to ...".`;
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
  pagesForEdits,
  buildPreferredDocumentName,
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test expressApi.test.js`
Expected: PASS — 11 tests passing

- [ ] **Step 5: Commit**

```bash
git add expressApi.js expressApi.test.js
git commit -m "feat: replace mocked Express API with real tagged-documents/generate-variation/status calls"
```

---

## Task 4: `actions.js` — wire the real edit flow

**Files:**
- Modify: `actions.js` (full rewrite)
- Modify: `actions.test.js` (full rewrite)

**Interfaces:**
- Consumes: `getTrackedImages`, `findTrackedImage`, `recordEdits` from `./imageStore` (Task 2); the `expressApi` module as a **namespace import** (`const expressApi = require('./expressApi')`, not destructured) from Task 3, specifically so tests can stub `expressApi.getTaggedDocument`/`generateVariation`/`pollJobStatus` directly without touching `global.fetch`.
- Produces: `actionListCampaignGraphics() -> Promise<string>` (unchanged), `actionCheckAllowedEdits(phoneNumber, imageId) -> Promise<string>`, `actionEditGraphic(phoneNumber, imageId, edits, { sendImage }) -> Promise<string>`, `actionGenerateBulkGraphics(filename) -> Promise<string>` (unchanged).

- [ ] **Step 1: Write the failing tests**

Create `actions.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { actionCheckAllowedEdits, actionEditGraphic } = require('./actions');
const expressApi = require('./expressApi');
const { findTrackedImage } = require('./imageStore');

function writeFixtureCatalog(entries) {
  const fixturePath = path.join(os.tmpdir(), `express-templates-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  fs.writeFileSync(fixturePath, JSON.stringify(entries));
  process.env.EXPRESS_TEMPLATES_FILE = fixturePath;
}

const SAMPLE_ELEMENTS_DOC = {
  documentPages: [
    {
      pageNumber: 1,
      taggedElements: [
        { name: 'heading', type: 'text', value: 'The X-Phone Pro is here!' },
        { name: 'cta', type: 'text', value: 'Available at our store starting 15 Aug 20XX.' },
      ],
    },
  ],
};

test('actionCheckAllowedEdits lists the tagged elements for a known image', async () => {
  writeFixtureCatalog([{ id: 'img_1', name: 'Croma Earbuds', docId: 'urn:doc:1' }]);
  expressApi.getTaggedDocument = async (docId) => {
    assert.equal(docId, 'urn:doc:1');
    return SAMPLE_ELEMENTS_DOC;
  };

  const reply = await actionCheckAllowedEdits('phone-1', 'img_1');

  assert.match(reply, /Croma Earbuds/);
  assert.match(reply, /heading: currently "The X-Phone Pro is here!"/);
  assert.match(reply, /cta: currently/);
});

test('actionCheckAllowedEdits reports unknown images without throwing', async () => {
  writeFixtureCatalog([{ id: 'img_1', name: 'Croma Earbuds', docId: 'urn:doc:1' }]);

  const reply = await actionCheckAllowedEdits('phone-2', 'img_nope');

  assert.match(reply, /couldn't find that image/);
});

test('actionCheckAllowedEdits returns a friendly message when the Express API call fails', async () => {
  writeFixtureCatalog([{ id: 'img_1', name: 'Croma Earbuds', docId: 'urn:doc:1' }]);
  expressApi.getTaggedDocument = async () => {
    throw new Error('getTaggedDocument failed 500: boom');
  };

  const reply = await actionCheckAllowedEdits('phone-3', 'img_1');

  assert.match(reply, /couldn't check the allowed edits/);
});

test('actionEditGraphic rejects edits outside the tagged elements and makes no generate call', async () => {
  writeFixtureCatalog([{ id: 'img_1', name: 'Croma Earbuds', docId: 'urn:doc:1' }]);
  expressApi.getTaggedDocument = async () => SAMPLE_ELEMENTS_DOC;
  expressApi.generateVariation = async () => {
    throw new Error('should not be called');
  };
  let sendImageCalled = false;
  const sendImage = async () => { sendImageCalled = true; };

  const reply = await actionEditGraphic('phone-4', 'img_1', { background_color: 'red' }, { sendImage });

  assert.match(reply, /can't edit background_color/);
  assert.equal(sendImageCalled, false);
});

test('actionEditGraphic applies an allowed edit end-to-end: generates, polls, sends the thumbnail, and records the edit', async () => {
  writeFixtureCatalog([{ id: 'img_1', name: 'Croma Earbuds', docId: 'urn:doc:1' }]);
  expressApi.getTaggedDocument = async () => SAMPLE_ELEMENTS_DOC;
  expressApi.generateVariation = async (docId, tagMappings, pages, preferredDocumentName) => {
    assert.equal(docId, 'urn:doc:1');
    assert.deepEqual(tagMappings, { cta: '20% off' });
    assert.equal(pages, '1');
    assert.match(preferredDocumentName, /^Croma Earbuds-edit-\d+$/);
    return { jobId: 'job-1', statusUrl: 'https://express-api.adobe.io/status/job-1' };
  };
  expressApi.pollJobStatus = async (jobId) => {
    assert.equal(jobId, 'job-1');
    return { status: 'succeeded', document: { thumbnailUrl: 'https://example.com/thumb.png' } };
  };

  const sentCalls = [];
  const sendImage = async (to, link) => { sentCalls.push({ to, link }); };

  const reply = await actionEditGraphic('phone-5', 'img_1', { cta: '20% off' }, { sendImage });

  assert.match(reply, /Updated "Croma Earbuds"/);
  assert.equal(sentCalls.length, 1);
  assert.equal(sentCalls[0].to, 'phone-5');
  assert.equal(sentCalls[0].link, 'https://example.com/thumb.png');

  const image = findTrackedImage('phone-5', 'img_1');
  assert.deepEqual(image.currentEdits, { cta: '20% off' });
});

test('actionEditGraphic returns a friendly message and does not record the edit when generation fails', async () => {
  writeFixtureCatalog([{ id: 'img_1', name: 'Croma Earbuds', docId: 'urn:doc:1' }]);
  expressApi.getTaggedDocument = async () => SAMPLE_ELEMENTS_DOC;
  expressApi.generateVariation = async () => { throw new Error('generateVariation failed 500: boom'); };

  let sendImageCalled = false;
  const sendImage = async () => { sendImageCalled = true; };

  const reply = await actionEditGraphic('phone-6', 'img_1', { cta: '20% off' }, { sendImage });

  assert.match(reply, /something went wrong generating/);
  assert.equal(sendImageCalled, false);

  const image = findTrackedImage('phone-6', 'img_1');
  assert.deepEqual(image.currentEdits, {});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test actions.test.js`
Expected: FAIL — old `actions.js` still validates against `getTemplateInfo`/hardcoded layers and calls `metaUpload`, not matching these assertions

- [ ] **Step 3: Write the implementation**

Replace the contents of `actions.js`:

```js
const { getTrackedImages, findTrackedImage, recordEdits } = require('./imageStore');
const expressApi = require('./expressApi');

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

  try {
    const doc = await expressApi.getTaggedDocument(image.docId);
    const elements = expressApi.collectTaggedElements(doc);
    return expressApi.formatAllowedEdits(image.name, elements);
  } catch (err) {
    console.error('[actionCheckAllowedEdits] Express API error', { docId: image.docId, message: err.message });
    return `Sorry, I couldn't check the allowed edits for "${image.name}" right now. Please try again in a moment.`;
  }
}

async function actionEditGraphic(phoneNumber, imageId, edits, { sendImage }) {
  const image = findTrackedImage(phoneNumber, imageId);
  if (!image) {
    return formatUnknownImageMessage(phoneNumber);
  }

  let elements;
  try {
    const doc = await expressApi.getTaggedDocument(image.docId);
    elements = expressApi.collectTaggedElements(doc);
  } catch (err) {
    console.error('[actionEditGraphic] Express API error', { docId: image.docId, message: err.message });
    return `Sorry, I couldn't reach Adobe Express to apply that edit. Please try again in a moment.`;
  }

  const allowedNames = elements.map((element) => element.name);
  const requestedKeys = Object.keys(edits || {});
  const disallowedKeys = requestedKeys.filter((key) => !allowedNames.includes(key));

  if (disallowedKeys.length > 0) {
    return `I can't edit ${disallowedKeys.join(', ')} on "${image.name}". ${expressApi.formatAllowedEdits(image.name, elements)}`;
  }

  const mergedEdits = { ...image.currentEdits, ...edits };
  const pages = expressApi.pagesForEdits(elements, Object.keys(mergedEdits));
  const preferredDocumentName = expressApi.buildPreferredDocumentName(image.name);

  let thumbnailUrl;
  try {
    const { jobId } = await expressApi.generateVariation(image.docId, mergedEdits, pages, preferredDocumentName);
    const result = await expressApi.pollJobStatus(jobId);
    thumbnailUrl = result.document.thumbnailUrl;
  } catch (err) {
    console.error('[actionEditGraphic] generate/poll error', { docId: image.docId, message: err.message });
    return `Sorry, something went wrong generating your updated "${image.name}". Please try again.`;
  }

  recordEdits(phoneNumber, imageId, edits);
  await sendImage(phoneNumber, thumbnailUrl);

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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test actions.test.js`
Expected: PASS — 6 tests passing

- [ ] **Step 5: Run the full test suite**

Run: `node --test`
Expected: PASS — all tests across `expressAuth.test.js`, `imageStore.test.js`, `expressApi.test.js`, `actions.test.js`, `metaUpload.test.js` passing

- [ ] **Step 6: Commit**

```bash
git add actions.js actions.test.js
git commit -m "feat: wire actions.js to the real Express API and drop mocked edit validation"
```

---

## Task 5: `app.js` webhook logging + `render.yaml` env vars

**Files:**
- Modify: `app.js:197-202` (incoming message loop)
- Modify: `render.yaml` (envVars list)

**Interfaces:**
- Consumes: nothing new — pure logging addition, no new imports.
- Produces: nothing new — verified manually (webhook route, no unit test, matching the existing pattern for `app.js`'s WhatsApp/webhook wiring).

- [ ] **Step 1: Add labeled webhook logging**

In `app.js`, inside the `for (const message of messages) {` loop in the `app.post('/')` handler, replace:

```js
    for (const message of messages) {
      const userText = message?.text?.body;
      if (!userText) continue;
```

with:

```js
    for (const message of messages) {
      if (message.context) console.log('[webhook] message.context:', JSON.stringify(message.context));
      if (message.referral) console.log('[webhook] message.referral:', JSON.stringify(message.referral));
      if (message.image) console.log('[webhook] message.image:', JSON.stringify(message.image));

      const userText = message?.text?.body;
      if (!userText) continue;
```

- [ ] **Step 2: Add the new env vars to `render.yaml`**

In `render.yaml`, add to the `envVars` list (after the existing `OPENAI_MODEL` entry):

```yaml
      - key: EXPRESS_CLIENT_ID
        sync: false
      - key: EXPRESS_CLIENT_SECRET
        sync: false
      - key: EXPRESS_API_SCOPE
        sync: false
      - key: EXPRESS_IMS_TOKEN_URL
        sync: false
      - key: EXPRESS_API_BASE_URL
        sync: false
      - key: EXPRESS_TEMPLATES_FILE
        sync: false
      - key: EXPRESS_STATUS_POLL_INTERVAL_MS
        sync: false
      - key: EXPRESS_STATUS_POLL_TIMEOUT_MS
        sync: false
```

- [ ] **Step 3: Verify the file is syntactically valid**

Run: `node --check app.js`
Expected: no output (silent success)

- [ ] **Step 4: Verify the server still boots and the webhook-verification route still works**

Run:

```bash
VERIFY_TOKEN=test WHATSAPP_PHONE_NUMBER_ID=123 WHATSAPP_TOKEN=test OPENAI_API_KEY=test EXPRESS_CLIENT_ID=test EXPRESS_CLIENT_SECRET=test node app.js &
SERVER_PID=$!
sleep 1
curl -s "http://localhost:3000/?hub.mode=subscribe&hub.verify_token=test&hub.challenge=hello123"
kill $SERVER_PID
```

Expected: `hello123` printed by curl, followed by `WEBHOOK VERIFIED` in the server's stdout before it's killed.

- [ ] **Step 5: Run the full test suite once more to confirm nothing broke**

Run: `node --test`
Expected: PASS — all tests passing (same count as end of Task 4)

- [ ] **Step 6: Commit**

```bash
git add app.js render.yaml
git commit -m "feat: log webhook metadata fields and declare Express API env vars"
```

---

## Self-Review Notes

- **Spec coverage:** IMS auth (Task 1), real `tagged-documents`/`generate-variation`/`status` calls (Task 3), shared `id`/`name`/`docId` catalog replacing hardcoded seed images (Task 2), simplified allowed-edits messaging and real-field validation (Tasks 3–4), generate→poll→send flow with `thumbnailUrl` sent directly (Task 4), `metaUpload.js` left in place and unused (Task 4, no import added), webhook metadata logging for docID investigation (Task 5), env var declarations (Task 5) — all covered. `actionListCampaignGraphics`/`actionGenerateBulkGraphics` and any new logic on `context`/`referral`/`image` fields are explicitly out of scope per the spec and untouched beyond logging.
- **Placeholder scan:** no TBDs; the two `// TODO: fetch from campaign API` / `// TODO: parse CSV/Excel...` comments are carried over unchanged from existing code (explicitly out of scope) and are intentional.
- **Type consistency:** `image.docId` (not `templateId`) used consistently across `imageStore.js` (Task 2), `expressApi.js` functions (Task 3), and `actions.js` (Task 4). `currentEdits` shape (`{ [tagName]: value }`) consistent between `imageStore.js`'s `recordEdits`/`getTrackedImages` and `actions.js`'s `mergedEdits` construction. `sendImage(to, link)` signature unchanged from the existing `app.js` implementation, matching its call site in Task 4. `expressApi` is a namespace import in `actions.js` (not destructured) specifically so `actions.test.js` can stub individual functions — noted in Task 4's Interfaces block so this doesn't look like an inconsistency with Task 3's plain destructure inside `expressApi.js` itself (that destructure is fine since `expressApi.test.js` stubs `global.fetch`, not `expressAuth`'s exports).
