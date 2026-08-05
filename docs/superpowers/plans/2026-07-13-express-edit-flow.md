# Express Image Edit Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a WhatsApp user ask what edits are allowed on a previously-sent graphic, request an edit, have it validated against the graphic's unlocked layers, applied via a mocked Adobe Express API, uploaded via a mocked Meta upload, and re-sent as an updated image — all with placeholder Express/Meta calls that can be swapped for real ones later.

**Architecture:** Three new small, dependency-free modules (`imageStore.js` for per-phone-number tracked-image state, `expressApi.js` for mock template/edit calls, `metaUpload.js` for the mock media upload) get unit tests via Node's built-in test runner. A fourth new module, `actions.js`, extracts all GPT tool-call action handlers (including the two existing ones, `list_campaign_graphics` and `generate_bulk_graphics`, moved unchanged) so the new `edit_graphic` logic can be unit-tested with a fake `sendImage` — no real WhatsApp/OpenAI credentials needed for tests. `app.js` is left as the thin orchestrator: WhatsApp API calls, GPT tool schemas/system prompt, and the webhook route wiring args into `actions.js`.

**Tech Stack:** Node.js 20, Express 5, `openai` SDK, Node's built-in `node:test` + `node:assert/strict` (no new dependencies).

## Global Constraints

- No real Adobe Express or Meta API calls — all such calls are placeholder/mock functions returning mock values (per spec, these get swapped for real implementations later).
- Actually sending the initial graphic image is out of scope — tracked images are pre-seeded in memory at first access per phone number (spec: 3 fixed seed entries: Diwali Offer Banner / Summer Sale Flyer / New Arrival Poster).
- State is in-memory only, no persistence across restarts (matches existing `conversationHistory` pattern in app.js).
- No new npm dependencies — use Node's built-in `node:test` test runner.
- Follow existing code style: CommonJS `require`, 2-space indentation, semicolons.

---

## Task 1: `imageStore.js` — tracked-image state

**Files:**
- Create: `imageStore.js`
- Test: `imageStore.test.js`
- Modify: `package.json` (add a `test` script)

**Interfaces:**
- Produces: `getTrackedImages(phoneNumber) -> Array<{ id: string, name: string, templateId: string, currentEdits: object }>` (seeds 3 fixed entries on first call for a phone number, returns the same array reference on later calls).
- Produces: `findTrackedImage(phoneNumber, imageId) -> object | undefined`.

- [ ] **Step 1: Write the failing test**

Create `imageStore.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { getTrackedImages, findTrackedImage } = require('./imageStore');

test('getTrackedImages seeds 3 images on first access', () => {
  const images = getTrackedImages('111');
  assert.equal(images.length, 3);
  assert.deepEqual(images.map((img) => img.id), ['img_1', 'img_2', 'img_3']);
  assert.deepEqual(images[0].currentEdits, {});
});

test('getTrackedImages returns the same array on repeated calls for the same phone number', () => {
  const first = getTrackedImages('222');
  first[0].currentEdits.headline = 'Flash Sale';
  const second = getTrackedImages('222');
  assert.equal(second[0].currentEdits.headline, 'Flash Sale');
});

test('getTrackedImages seeds independently per phone number', () => {
  getTrackedImages('333')[0].currentEdits.headline = 'Only for 333';
  const other = getTrackedImages('444');
  assert.deepEqual(other[0].currentEdits, {});
});

test('findTrackedImage returns the matching image', () => {
  getTrackedImages('555');
  const image = findTrackedImage('555', 'img_2');
  assert.equal(image.name, 'Summer Sale Flyer');
});

test('findTrackedImage returns undefined for an unknown id', () => {
  getTrackedImages('666');
  const image = findTrackedImage('666', 'img_999');
  assert.equal(image, undefined);
});
```

- [ ] **Step 2: Add the test script and run to verify failure**

Modify `package.json` scripts section to:

```json
"scripts": {
  "start": "node app.js",
  "test": "node --test"
},
```

Run: `node --test imageStore.test.js`
Expected: FAIL — `Cannot find module './imageStore'`

- [ ] **Step 3: Write the implementation**

Create `imageStore.js`:

```js
const SEED_IMAGES = [
  { id: 'img_1', name: 'Diwali Offer Banner', templateId: 'tpl_diwali' },
  { id: 'img_2', name: 'Summer Sale Flyer', templateId: 'tpl_summer' },
  { id: 'img_3', name: 'New Arrival Poster', templateId: 'tpl_newarrival' },
];

const trackedImages = new Map();

function getTrackedImages(phoneNumber) {
  if (!trackedImages.has(phoneNumber)) {
    trackedImages.set(
      phoneNumber,
      SEED_IMAGES.map((image) => ({ ...image, currentEdits: {} }))
    );
  }
  return trackedImages.get(phoneNumber);
}

function findTrackedImage(phoneNumber, imageId) {
  return getTrackedImages(phoneNumber).find((image) => image.id === imageId);
}

module.exports = { getTrackedImages, findTrackedImage };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test imageStore.test.js`
Expected: PASS — 5 tests passing

- [ ] **Step 5: Commit**

```bash
git add imageStore.js imageStore.test.js package.json
git commit -m "feat: add in-memory tracked-image store"
```

---

## Task 2: `expressApi.js` — mock Adobe Express calls

**Files:**
- Create: `expressApi.js`
- Test: `expressApi.test.js`

**Interfaces:**
- Consumes: nothing (standalone module).
- Produces: `getTemplateInfo(templateId) -> { templateId: string, unlockedLayers: string[] }`.
- Produces: `applyEdit(templateId, currentEdits, newEdits) -> { mergedEdits: object, renderedImageUrl: string }`.

- [ ] **Step 1: Write the failing test**

Create `expressApi.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { getTemplateInfo, applyEdit } = require('./expressApi');

test('getTemplateInfo returns the unlocked layers for a known template', () => {
  const info = getTemplateInfo('tpl_diwali');
  assert.deepEqual(info, {
    templateId: 'tpl_diwali',
    unlockedLayers: ['discount_text', 'headline', 'background_color'],
  });
});

test('getTemplateInfo returns an empty layer list for an unknown template', () => {
  const info = getTemplateInfo('tpl_does_not_exist');
  assert.deepEqual(info.unlockedLayers, []);
});

test('applyEdit merges new edits on top of current edits', () => {
  const result = applyEdit('tpl_diwali', { headline: 'Old Headline' }, { discount_text: '70%' });
  assert.deepEqual(result.mergedEdits, { headline: 'Old Headline', discount_text: '70%' });
});

test('applyEdit returns a rendered image url that references the template', () => {
  const result = applyEdit('tpl_summer', {}, { headline: 'Flash Sale' });
  assert.match(result.renderedImageUrl, /^https:\/\/mock-express\.local\/render\/tpl_summer\?rev=\d+$/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test expressApi.test.js`
Expected: FAIL — `Cannot find module './expressApi'`

- [ ] **Step 3: Write the implementation**

Create `expressApi.js`:

```js
const TEMPLATE_LAYERS = {
  tpl_diwali: ['discount_text', 'headline', 'background_color'],
  tpl_summer: ['headline', 'font_color'],
  tpl_newarrival: ['headline'],
};

function getTemplateInfo(templateId) {
  return {
    templateId,
    unlockedLayers: TEMPLATE_LAYERS[templateId] || [],
  };
}

let renderRevision = 0;

function applyEdit(templateId, currentEdits, newEdits) {
  const mergedEdits = { ...currentEdits, ...newEdits };
  renderRevision += 1;
  return {
    mergedEdits,
    renderedImageUrl: `https://mock-express.local/render/${templateId}?rev=${renderRevision}`,
  };
}

module.exports = { getTemplateInfo, applyEdit };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test expressApi.test.js`
Expected: PASS — 4 tests passing

- [ ] **Step 5: Commit**

```bash
git add expressApi.js expressApi.test.js
git commit -m "feat: add mock Adobe Express API module"
```

---

## Task 3: `metaUpload.js` — mock Meta media upload

**Files:**
- Create: `metaUpload.js`
- Test: `metaUpload.test.js`

**Interfaces:**
- Consumes: nothing (standalone module).
- Produces: `uploadImageToMeta(renderedImageUrl) -> Promise<string>` (mock CDN URL).

- [ ] **Step 1: Write the failing test**

Create `metaUpload.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { uploadImageToMeta } = require('./metaUpload');

test('uploadImageToMeta returns a mock CDN url', async () => {
  const url = await uploadImageToMeta('https://mock-express.local/render/tpl_diwali?rev=1');
  assert.match(url, /^https:\/\/mock-meta-cdn\.local\/media\/[0-9a-f-]+\.png$/);
});

test('uploadImageToMeta returns a different url on each call', async () => {
  const first = await uploadImageToMeta('https://mock-express.local/render/tpl_diwali?rev=1');
  const second = await uploadImageToMeta('https://mock-express.local/render/tpl_diwali?rev=2');
  assert.notEqual(first, second);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test metaUpload.test.js`
Expected: FAIL — `Cannot find module './metaUpload'`

- [ ] **Step 3: Write the implementation**

Create `metaUpload.js`:

```js
const { randomUUID } = require('node:crypto');

async function uploadImageToMeta(renderedImageUrl) {
  return `https://mock-meta-cdn.local/media/${randomUUID()}.png`;
}

module.exports = { uploadImageToMeta };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test metaUpload.test.js`
Expected: PASS — 2 tests passing

- [ ] **Step 5: Commit**

```bash
git add metaUpload.js metaUpload.test.js
git commit -m "feat: add mock Meta media upload module"
```

---

## Task 4: `actions.js` — extract and extend GPT tool-call action handlers

**Files:**
- Create: `actions.js`
- Test: `actions.test.js`

**Interfaces:**
- Consumes: `getTrackedImages`, `findTrackedImage` from `./imageStore` (Task 1); `getTemplateInfo`, `applyEdit` from `./expressApi` (Task 2); `uploadImageToMeta` from `./metaUpload` (Task 3).
- Produces: `actionListCampaignGraphics() -> Promise<string>` (unchanged behavior, moved from app.js).
- Produces: `actionCheckAllowedEdits(phoneNumber, imageId) -> Promise<string>`.
- Produces: `actionEditGraphic(phoneNumber, imageId, edits, { sendImage }) -> Promise<string>` — `sendImage` is injected `(to, link) => Promise<void>` so tests don't need real WhatsApp calls.
- Produces: `actionGenerateBulkGraphics(filename) -> Promise<string>` (unchanged behavior, moved from app.js).

- [ ] **Step 1: Write the failing test**

Create `actions.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { actionCheckAllowedEdits, actionEditGraphic } = require('./actions');
const { getTrackedImages } = require('./imageStore');

test('actionCheckAllowedEdits lists the unlocked layers for a known image', async () => {
  const reply = await actionCheckAllowedEdits('phone-1', 'img_1');
  assert.match(reply, /Diwali Offer Banner/);
  assert.match(reply, /discount_text/);
});

test('actionCheckAllowedEdits reports unknown images without throwing', async () => {
  const reply = await actionCheckAllowedEdits('phone-2', 'img_nope');
  assert.match(reply, /couldn't find that image/);
});

test('actionEditGraphic rejects edits outside the unlocked layers and sends nothing', async () => {
  let sendImageCalled = false;
  const sendImage = async () => {
    sendImageCalled = true;
  };

  const reply = await actionEditGraphic('phone-3', 'img_3', { background_color: 'red' }, { sendImage });

  assert.match(reply, /can't edit background_color/);
  assert.equal(sendImageCalled, false);
});

test('actionEditGraphic applies an allowed edit, sends the updated image, and remembers the edit', async () => {
  const sentCalls = [];
  const sendImage = async (to, link) => {
    sentCalls.push({ to, link });
  };

  const reply = await actionEditGraphic('phone-4', 'img_2', { headline: 'Flash Sale' }, { sendImage });

  assert.match(reply, /Updated "Summer Sale Flyer"/);
  assert.equal(sentCalls.length, 1);
  assert.equal(sentCalls[0].to, 'phone-4');
  assert.match(sentCalls[0].link, /^https:\/\/mock-meta-cdn\.local\//);

  const image = getTrackedImages('phone-4').find((img) => img.id === 'img_2');
  assert.equal(image.currentEdits.headline, 'Flash Sale');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test actions.test.js`
Expected: FAIL — `Cannot find module './actions'`

- [ ] **Step 3: Write the implementation**

Create `actions.js`:

```js
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
  return 'Graphics in your current campaign:\n1. Diwali Offer Banner\n2. Summer Sale Flyer\n3. New Arrival Poster';
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test actions.test.js`
Expected: PASS — 4 tests passing

- [ ] **Step 5: Run the full test suite**

Run: `node --test`
Expected: PASS — all tests across `imageStore.test.js`, `expressApi.test.js`, `metaUpload.test.js`, `actions.test.js` (15 tests total)

- [ ] **Step 6: Commit**

```bash
git add actions.js actions.test.js
git commit -m "feat: extract GPT action handlers and add image-edit validation flow"
```

---

## Task 5: Wire `app.js` to the new modules

**Files:**
- Modify: `app.js:1-2` (imports)
- Modify: `app.js:59-120` (tool definitions)
- Modify: `app.js:122-143` (delete — action handlers now live in `actions.js`)
- Modify: `app.js:147-174` (`decideAction` system prompt)
- Modify: `app.js:218-245` (webhook switch statement)

**Interfaces:**
- Consumes: `getTrackedImages` from `./imageStore` (Task 1); `actionListCampaignGraphics`, `actionCheckAllowedEdits`, `actionEditGraphic`, `actionGenerateBulkGraphics` from `./actions` (Task 4).
- Produces: nothing new — this task is pure wiring, verified manually (no unit test; this is the orchestration layer that touches the real WhatsApp/OpenAI SDKs already excluded from automated testing per the spec).

- [ ] **Step 1: Update imports**

At the top of `app.js`, replace:

```js
const express = require('express');
const OpenAI = require('openai');
```

with:

```js
const express = require('express');
const OpenAI = require('openai');
const { getTrackedImages } = require('./imageStore');
const {
  actionListCampaignGraphics,
  actionCheckAllowedEdits,
  actionEditGraphic,
  actionGenerateBulkGraphics,
} = require('./actions');
```

- [ ] **Step 2: Add `image_id` to the `check_allowed_edits` and `edit_graphic` tool definitions**

In the `tools` array, replace the `check_allowed_edits` entry:

```js
  {
    type: 'function',
    function: {
      name: 'check_allowed_edits',
      description: 'Check what edits are permitted on the current graphic',
      parameters: { type: 'object', properties: {} },
    },
  },
```

with:

```js
  {
    type: 'function',
    function: {
      name: 'check_allowed_edits',
      description:
        'Check what edits are permitted on a specific graphic. Pick image_id from the "Images previously sent to this user" list in the system prompt that best matches what the user is referring to.',
      parameters: {
        type: 'object',
        properties: {
          image_id: { type: 'string', description: 'The id of the image the user is asking about, from the tracked images list' },
        },
        required: ['image_id'],
      },
    },
  },
```

And replace the `edit_graphic` entry:

```js
  {
    type: 'function',
    function: {
      name: 'edit_graphic',
      description: 'Edit the current graphic via Adobe Express API (e.g. change discount text, colors)',
      parameters: {
        type: 'object',
        properties: {
          edits: {
            type: 'object',
            description: 'Key-value pairs of edits to apply, e.g. { "discount_text": "70%" }',
          },
        },
        required: ['edits'],
      },
    },
  },
```

with:

```js
  {
    type: 'function',
    function: {
      name: 'edit_graphic',
      description:
        'Edit a specific graphic via Adobe Express API (e.g. change discount text, colors). Pick image_id from the "Images previously sent to this user" list in the system prompt that best matches what the user is referring to.',
      parameters: {
        type: 'object',
        properties: {
          image_id: { type: 'string', description: 'The id of the image to edit, from the tracked images list' },
          edits: {
            type: 'object',
            description: 'Key-value pairs of edits to apply, e.g. { "discount_text": "70%" }',
          },
        },
        required: ['image_id', 'edits'],
      },
    },
  },
```

- [ ] **Step 3: Delete the old inline action handlers**

Delete this entire block (now provided by `actions.js`):

```js
// ── Action handlers (stubs — wire real APIs here) ────────────────────────────

async function actionListCampaignGraphics() {
  // TODO: fetch from campaign API
  return 'Graphics in your current campaign:\n1. Diwali Offer Banner\n2. Summer Sale Flyer\n3. New Arrival Poster';
}

async function actionCheckAllowedEdits() {
  // TODO: fetch from Adobe Express API
  return 'Edits allowed on the current graphic:\n- Discount percentage\n- Headline text\n- Background color\n- Font color';
}

async function actionEditGraphic(edits) {
  // TODO: call Adobe Express API
  const summary = Object.entries(edits).map(([k, v]) => `• ${k}: ${v}`).join('\n');
  return `Graphic updated successfully:\n${summary}`;
}

async function actionGenerateBulkGraphics(filename) {
  // TODO: parse CSV/Excel and call Adobe Express API per row
  return `Bulk generation complete! Graphics created from ${filename || 'your uploaded file'}.`;
}
```

- [ ] **Step 4: Add the tracked-images list to the `decideAction` system prompt**

Replace:

```js
async function decideAction(phoneNumber, userMessage) {
  const last3 = getHistory(phoneNumber).slice(-3);

  const messages = [
    {
      role: 'system',
      content: `You are a WhatsApp assistant for managing marketing campaign graphics via Adobe Express.
Analyze the user's message and conversation history, then call the appropriate tool.
Always call exactly one tool — never reply with plain text.
If the request is ambiguous or missing details, use ask_for_more_information.`,
    },
    ...last3,
    { role: 'user', content: userMessage },
  ];
```

with:

```js
async function decideAction(phoneNumber, userMessage) {
  const last3 = getHistory(phoneNumber).slice(-3);
  const trackedImages = getTrackedImages(phoneNumber);
  const imagesList = trackedImages.map((image) => `- ${image.id}: ${image.name}`).join('\n');

  const messages = [
    {
      role: 'system',
      content: `You are a WhatsApp assistant for managing marketing campaign graphics via Adobe Express.
Analyze the user's message and conversation history, then call the appropriate tool.
Always call exactly one tool — never reply with plain text.
If the request is ambiguous or missing details, use ask_for_more_information.

Images previously sent to this user (reference by id):
${imagesList}`,
    },
    ...last3,
    { role: 'user', content: userMessage },
  ];
```

- [ ] **Step 5: Pass `phoneNumber`/`image_id`/`sendImage` through the webhook switch**

Replace:

```js
        case 'check_allowed_edits':
          await sendText(phoneNumber, '⏳ Checking allowed edits...');
          replyText = await actionCheckAllowedEdits();
          break;

        case 'edit_graphic':
          await sendText(phoneNumber, '⏳ Applying edits to your graphic...');
          replyText = await actionEditGraphic(args.edits);
          break;
```

with:

```js
        case 'check_allowed_edits':
          await sendText(phoneNumber, '⏳ Checking allowed edits...');
          replyText = await actionCheckAllowedEdits(phoneNumber, args.image_id);
          break;

        case 'edit_graphic':
          await sendText(phoneNumber, '⏳ Applying edits to your graphic...');
          replyText = await actionEditGraphic(phoneNumber, args.image_id, args.edits, { sendImage });
          break;
```

- [ ] **Step 6: Verify the file is syntactically valid**

Run: `node --check app.js`
Expected: no output (silent success)

- [ ] **Step 7: Verify the server still boots and the webhook-verification route still works**

Run:

```bash
VERIFY_TOKEN=test WHATSAPP_PHONE_NUMBER_ID=123 WHATSAPP_TOKEN=test OPENAI_API_KEY=test node app.js &
SERVER_PID=$!
sleep 1
curl -s "http://localhost:3000/?hub.mode=subscribe&hub.verify_token=test&hub.challenge=hello123"
kill $SERVER_PID
```

Expected: `hello123` printed by curl, followed by `WEBHOOK VERIFIED` in the server's stdout before it's killed.

- [ ] **Step 8: Run the full test suite once more to confirm nothing broke**

Run: `node --test`
Expected: PASS — all 15 tests passing

- [ ] **Step 9: Commit**

```bash
git add app.js
git commit -m "feat: wire image-edit flow into the webhook and GPT tool schema"
```

---

## Self-Review Notes

- **Spec coverage:** template/layer lookup (Task 2), allowed-edit validation (Task 4 `actionEditGraphic`), Express edit + Meta upload + re-send (Task 4 + Task 5 wiring), image reference inferred by GPT from a system-prompt-provided list (Task 5 Step 4), pre-seeded mock images since real sending is out of scope (Task 1) — all covered.
- **Placeholder scan:** no TBDs; the two `// TODO: fetch from campaign API` / `// TODO: parse CSV/Excel...` comments are carried over unchanged from the existing code (out of scope for this feature) and are intentional, not gaps in this plan.
- **Type consistency:** `sendImage` signature `(to, link) => Promise<void>` is consistent between `actions.js`'s `actionEditGraphic` (Task 4) and its call site in `app.js` (Task 5 Step 5), which passes the existing `sendImage(to, link)` from `app.js`. `image.id`/`image.name`/`image.templateId`/`image.currentEdits` field names are consistent across `imageStore.js`, `expressApi.js` consumers, and `actions.js`.
