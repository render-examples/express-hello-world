# Design: Real Adobe Express API integration for the image-edit flow

Amends [2026-07-13-express-edit-flow-design.md](./2026-07-13-express-edit-flow-design.md) and [2026-07-13-global-fixed-edit-response-design.md](./2026-07-13-global-fixed-edit-response-design.md), replacing the mocked/fixed behavior those introduced with real Adobe Express API calls.

## Goal

Replace all hardcoding and mocked responses in the image-edit flow with real calls to the Adobe Express API:

1. `GET /beta/tagged-documents/<docId>` to discover what's editable on a graphic and show the user a simplified list.
2. `POST /beta/generate-variation` to apply the user's requested edits.
3. `GET /status/<jobId>` to poll until the variation is ready.
4. Send the resulting `thumbnailUrl` back to the user as a new WhatsApp image message.

The identity of *which* Express document a tracked image maps to comes from a JSON catalog shared with the separate UI repo (out of scope for this change), not from anything invented in this backend.

## Shared catalog: `data/express-templates.json`

Committed to this repo (not gitignored), maintained in step with an equivalent file in the UI repo:

```json
[
  { "id": "img_1", "name": "Diwali Offer Banner", "docId": "urn:aaid:sc:AP:..." },
  { "id": "img_2", "name": "Summer Sale Flyer", "docId": "urn:aaid:sc:AP:..." },
  { "id": "img_3", "name": "Croma Earbuds", "docId": "urn:aaid:sc:AP:aaed427c-b4e4-55e4-b924-74d375f91684" }
]
```

- Flat array, `id`/`name`/`docId` only — no `phoneNumber`. It's a global catalog of known templates/images, not a per-customer sent-images log (the UI app's `sendWhatsAppTemplateMessage` already carries `docId` alongside `templateName` on its own send calls; this file is the read side this backend needs).
- Path is overridable via `EXPRESS_TEMPLATES_FILE` env var, defaulting to `data/express-templates.json`.
- Keeping both repos' copies of this file in sync (git submodule, manual copy, CI step, etc.) is out of scope for this change — flagged, not solved, here.

## New module: `expressAuth.js`

```js
async function getAccessToken() // returns a cached IMS access token, refreshing near expiry
async function buildAuthHeaders() // -> { Authorization: 'Bearer <token>', 'X-API-KEY': <clientId> }
```

- `POST https://ims-na1.adobelogin.com/ims/token/v3` (overridable via `EXPRESS_IMS_TOKEN_URL`), `grant_type=client_credentials`, `client_id`/`client_secret` from `EXPRESS_CLIENT_ID`/`EXPRESS_CLIENT_SECRET`, `scope` from `EXPRESS_API_SCOPE` (default `ee.express_api,openid,AdobeID,read_organizations,additional_info.projectedProductContext`, taken from a decoded sample token).
- `X-API-KEY` is `EXPRESS_CLIENT_ID` (confirmed identical to the sample token's `client_id` claim).
- Token cached in memory with its expiry; refetched once within 60s of expiry.
- **Assumption to verify on first real call:** Adobe IMS v3 token responses have historically returned `expires_in` in **milliseconds**, not seconds (unlike v2). This module treats `expires_in` as milliseconds directly (`expiresAt = Date.now() + Number(expires_in)`). If the real response turns out to be in seconds, this is a one-line fix isolated to this function.

## Rewritten module: `expressApi.js`

No more `TEMPLATE_LAYERS`/mock render. Real HTTP calls against `EXPRESS_API_BASE_URL` (default `https://express-api.adobe.io`), using `expressAuth.buildAuthHeaders()`:

```js
async function getTaggedDocument(docId)
// GET /beta/tagged-documents/<docId>
// -> { name, id, documentPages: [{ pageNumber, taggedElements: [{ name, type, value?, position, size }] }] }

async function generateVariation(docId, tagMappings, pages, preferredDocumentName)
// POST /beta/generate-variation
// body: { id: docId, variationDetails: { pages, preferredDocumentName, tagMappings } }
// -> { jobId, statusUrl }

async function getJobStatus(jobId)
// GET /status/<jobId>
// -> { jobId, status, document?: { name, id, thumbnailUrl } }

async function pollJobStatus(jobId, { intervalMs, timeoutMs } = {})
// Polls getJobStatus every intervalMs (default EXPRESS_STATUS_POLL_INTERVAL_MS=2000)
// until status === 'succeeded' (returns the full result) or 'failed' (throws),
// or until timeoutMs elapses (default EXPRESS_STATUS_POLL_TIMEOUT_MS=60000, throws).
```

Non-2xx responses from any of the three GET/POST calls throw with the HTTP status and response body included in the error message, for logging by the caller.

### Helpers (co-located in `expressApi.js`)

```js
function collectTaggedElements(taggedDocument)
// Flattens documentPages[].taggedElements[] into one array, each tagged with its pageNumber.

function formatAllowedEdits(name, elements)
// Simplified user-facing text, e.g.:
// Edits allowed on "Croma Earbuds":
// - heading: currently "The X-Phone Pro is here!"
// - cta: currently "Available at our store starting 15 Aug 20XX."
// Tell me what you'd like to change and to what, e.g. "change cta to ...".
// Non-text element types are listed as "- <name> (<type>)" without a current value.

function pagesForEdits(elements, editKeys)
// -> comma-joined, ascending page numbers whose taggedElements include any of editKeys, e.g. "1" or "1,2".

function buildPreferredDocumentName(baseName)
// -> `${baseName}-edit-${Date.now()}`
```

## Rewritten module: `imageStore.js`

```js
function getTrackedImages(phoneNumber)
// Reads data/express-templates.json fresh on every call (no caching of the catalog itself),
// merges in this conversation's accumulated tagMappings.
// -> Array<{ id, name, docId, currentEdits }>

function findTrackedImage(phoneNumber, imageId)
// -> single entry from getTrackedImages(phoneNumber), or undefined

function recordEdits(phoneNumber, imageId, newEdits)
// Merges newEdits into the in-memory Map<"phone:id", tagMappings> and returns the merged object.
// Only called after a generate-variation call succeeds (see actions.js below) —
// a failed/timed-out edit does not get committed, so a retry starts from the last-known-good state.
```

Catalog read failures (missing/invalid file) are logged and treated as an empty catalog (no images tracked) rather than crashing the process.

## `metaUpload.js`

Left in place, untouched, exports unchanged — but no longer imported by `actions.js`. `generate-variation`'s `status` response already returns a public, directly-fetchable `thumbnailUrl`, so there's no upload hop needed. `metaUpload.test.js` stays as-is since the module's own behavior isn't changing.

## Rewritten `actions.js`

```js
async function actionCheckAllowedEdits(phoneNumber, imageId) {
  // unknown-image guard unchanged (formatUnknownImageMessage)
  // getTaggedDocument(image.docId) -> collectTaggedElements -> formatAllowedEdits(image.name, elements)
  // Express API errors: log technical detail, return a generic friendly retry message (no crash, no raw error to the user)
}

async function actionEditGraphic(phoneNumber, imageId, edits, { sendImage }) {
  // unknown-image guard unchanged
  // getTaggedDocument(image.docId) -> collectTaggedElements -> allowedNames
  // requestedKeys not in allowedNames -> same "I can't edit X, allowed edits are: <formatAllowedEdits>" rejection as before, no Express/generate call made
  // mergedEdits = { ...image.currentEdits, ...edits }
  // pages = pagesForEdits(elements, Object.keys(mergedEdits))
  // preferredDocumentName = buildPreferredDocumentName(image.name)
  // generateVariation(image.docId, mergedEdits, pages, preferredDocumentName) -> jobId
  // pollJobStatus(jobId) -> result
  // recordEdits(phoneNumber, imageId, edits)  // only on success
  // sendImage(phoneNumber, result.document.thumbnailUrl)
  // generate/poll errors: log technical detail, return a generic friendly retry message
  // Returns the same "Updated \"<name>\":\n<summary>" confirmation text as before on success
}
```

`actionListCampaignGraphics` and `actionGenerateBulkGraphics` are unchanged (still out of scope — their existing `// TODO` mocks stay as-is).

## `app.js` — webhook logging only

No behavior change to the GPT tool flow. In the incoming-message loop, before the existing `if (!userText) continue`, add labeled logging for fields that might carry the UI app's per-message metadata, so a real test send lets you find where (if anywhere) a docID rides along in this app's webhook payload, independent of the `data/express-templates.json` catalog:

```js
if (message.context) console.log('[webhook] message.context:', JSON.stringify(message.context));
if (message.referral) console.log('[webhook] message.referral:', JSON.stringify(message.referral));
if (message.image) console.log('[webhook] message.image:', JSON.stringify(message.image));
```

This is observability only — no new logic acts on these fields. Actually handling incoming image messages (or any other message type beyond text) stays out of scope, same as the original design.

## Environment variables

New, added to `render.yaml` (`sync: false` for secrets, matching existing `OPENAI_API_KEY` pattern):

- `EXPRESS_CLIENT_ID` (required, secret)
- `EXPRESS_CLIENT_SECRET` (required, secret)
- `EXPRESS_API_SCOPE` (optional, has default)
- `EXPRESS_IMS_TOKEN_URL` (optional, has default)
- `EXPRESS_API_BASE_URL` (optional, has default)
- `EXPRESS_TEMPLATES_FILE` (optional, has default)
- `EXPRESS_STATUS_POLL_INTERVAL_MS` (optional, has default)
- `EXPRESS_STATUS_POLL_TIMEOUT_MS` (optional, has default)

## Error handling

- Unknown `image_id` (GPT hallucination): unchanged friendly message, no crash.
- Disallowed edit field(s): unchanged rejection listing what's actually allowed, no Express calls made — now driven by real `taggedElements` instead of hardcoded layers.
- Any Adobe Express HTTP error (auth failure, 404 doc not found, network error), and any poll timeout/failure: caught in `actions.js`, logged with technical detail (status, docId/jobId, message), and surfaced to the user as a short generic retry message — never a raw stack trace or API error body over WhatsApp.
- A failed/timed-out edit does not get merged into the conversation's `tagMappings`, so retrying re-sends the last-known-good edit set plus the new attempt, rather than compounding a bad state.

## Testing

No new npm dependencies — tests stub `global.fetch` directly (Node's built-in `node:test`, matching the existing pattern; `app.js` already relies on global `fetch` for WhatsApp calls).

- `expressAuth.test.js` (new): fetches and caches a token; refetches once near-expiry; builds the right headers.
- `expressApi.test.js` (rewritten): `getTaggedDocument`/`generateVariation`/`getJobStatus` send the right URL/method/body/headers and parse responses correctly; `pollJobStatus` resolves on `succeeded`, throws on `failed`, throws on timeout without exceeding it; `collectTaggedElements`/`formatAllowedEdits`/`pagesForEdits`/`buildPreferredDocumentName` unit-tested directly against sample API response shapes.
- `imageStore.test.js` (rewritten): reads a fixture catalog file; `recordEdits` accumulates correctly per `(phoneNumber, imageId)`; missing/invalid catalog file degrades to an empty list without throwing.
- `actions.test.js` (rewritten): known-image allowed-edits listing; unknown-image guard; disallowed-field rejection (no generate call); happy path (generate → poll → `sendImage` called with `thumbnailUrl`, edits recorded); generate/poll failure path (friendly message, `sendImage` not called, edits not recorded).
- `metaUpload.test.js`: untouched.

## Out of scope

- Keeping the two repos' `data/express-templates.json` copies in sync.
- Any new logic acting on `message.context`/`message.referral`/`message.image` beyond logging them.
- `actionListCampaignGraphics` / `actionGenerateBulkGraphics` real implementations.
- Handling of non-text incoming WhatsApp message types beyond the added logging.
