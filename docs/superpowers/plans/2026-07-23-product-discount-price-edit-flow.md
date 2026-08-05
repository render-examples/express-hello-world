# Edit Product/Discount/Price Menu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the dynamic per-document edit menu with a fixed "Edit Product / Edit Discount / Edit Price" quick-reply menu for Express-catalog graphics, add a WhatsApp list picker for choosing a TV model, generalize the 40%-discount cap to cover GPT-computed price edits, and make the bot's confirmation/rejection replies mirror the user's language (English or Hinglish) via a GPT phrasing pass.

**Architecture:** `actions.js` gains a fixed-menu builder and a generalized price/discount cap check, and its Express-edit path (`editExpressDesign`) switches from returning hardcoded reply strings to structured outcome objects (`{ status, ... }`). `app.js` gains a WhatsApp list-message sender, a second (tool-free) OpenAI call that phrases those structured outcomes into user-facing text matching the user's language style, and new system-prompt rules routing the fixed menu's three bare fields ("product"/"discount"/"price") to the right tool, including GPT-side discount→price computation. Local/Onam-design edits (`source: 'local'`) are untouched throughout.

**Tech Stack:** Node.js, Express, `openai` SDK (chat completions, tool calling), WhatsApp Cloud API interactive messages, `node --test` + `node:assert/strict`.

## Global Constraints

- `MAX_DISCOUNT_PERCENT = 40` (existing, `src/actions.js:54`) — the hard cap on any discount, however it's expressed.
- New `ROUNDING_TOLERANCE_PERCENT = 0.5` — whole-rupee price rounding means a requested discount at exactly the cap can imply 40.0012% or 39.9988%; the cap check compares against `MAX_DISCOUNT_PERCENT + ROUNDING_TOLERANCE_PERCENT`, not a strict `>`.
- WhatsApp reply-button messages cap out at 3 buttons per message (existing `BUTTONS_PER_MESSAGE = 3`, `src/app.js:85`) — unchanged, still used for the fixed 3-option menu.
- WhatsApp list-message row titles must stay under ~24 characters — the 3 existing TV model titles ("Sony Bravia K-75", "LG UA82 AI", "Samsung UA4") already fit; no truncation logic needed for this feature.
- This feature applies **only** to `source: 'express'` tracked images (the Express-catalog templates). `source: 'local'` (Onam-style canned designs) keeps today's dynamic field-list menu and plain-string replies — do not touch `editLocalDesign`, `localEditElements`, or their tests.
- `app.js` has zero automated unit tests today and cannot be safely `require()`'d in a test file: constructing the module-level `OpenAI` client throws immediately without `OPENAI_API_KEY` set, and the file calls `app.listen(...)` unconditionally at load time. Per existing project convention, do **not** add unit tests for `sendList`, `phraseOutcome`, the dispatch wiring, or the system-prompt changes — verify those via the manual/simulated webhook check in the final task instead. All automated test coverage in this plan lives in `actions.test.js` (pure/deterministic logic only).
- Existing constants stay as-is and must not be redefined: `TV_PLACEHOLDER_IMAGE_URL`, `TV_MODEL_TITLES`, `TV_MODEL_EDITS` (`src/actions.js:7-9`).

---

### Task 1: Generalize the discount cap and switch Express edits to structured outcomes

**Files:**
- Modify: `src/actions.js:54-63` (keep `MAX_DISCOUNT_PERCENT`/`isDiscountField`/`parsePercent` as-is, add new helpers alongside)
- Modify: `src/actions.js:204-260` (`editExpressDesign`)
- Test: `src/actions.test.js:74-150` (update existing `actionEditGraphic` tests, add new ones)

**Interfaces:**
- Consumes: `expressApi.getTaggedDocument`, `expressApi.collectTaggedElements`, `expressApi.generateVariation`, `expressApi.pollJobStatus`, `expressApi.pagesForEdits`, `expressApi.buildPreferredDocumentName`, `expressApi.formatAllowedEdits` (all unchanged signatures), `recordEdits`, `withCurrentEdits` (unchanged).
- Produces: `editExpressDesign(phoneNumber, image, edits, { sendImage })` now resolves to one of:
  - `{ status: 'api_error', productName, reason: 'lookup_failed' | 'generate_failed' }`
  - `{ status: 'disallowed_fields', productName, disallowedKeys, allowedSummary }`
  - `{ status: 'discount_capped', productName, maxPercent }`
  - `{ status: 'delivery_failed', productName, changes }`
  - `{ status: 'success', productName, changes }`

  `actionEditGraphic` is an unchanged pass-through, so it now returns a **string** for `source: 'local'` images and an **object** (one of the shapes above) for `source: 'express'` images. Task 5 updates `app.js`'s dispatch to handle both.

- [ ] **Step 1: Update the existing `actionEditGraphic` tests in `src/actions.test.js` to expect structured outcomes**

Replace the test at line 74 (`'actionEditGraphic rejects edits outside the tagged elements...'`):

```js
test('actionEditGraphic returns a disallowed_fields status and makes no generate call for a field outside the tagged elements', async () => {
  writeFixtureCatalog([{ id: 'img_1', name: 'Croma Earbuds', docId: 'urn:doc:1' }]);
  expressApi.getTaggedDocument = async () => SAMPLE_ELEMENTS_DOC;
  expressApi.generateVariation = async () => {
    throw new Error('should not be called');
  };
  let sendImageCalled = false;
  const sendImage = async () => { sendImageCalled = true; };

  const result = await actionEditGraphic('phone-4', 'img_1', { background_color: 'red' }, { sendImage });

  assert.equal(result.status, 'disallowed_fields');
  assert.equal(result.productName, 'Croma Earbuds');
  assert.deepEqual(result.disallowedKeys, ['background_color']);
  assert.match(result.allowedSummary, /Edits allowed on "Croma Earbuds"/);
  assert.equal(sendImageCalled, false);
});
```

Replace the test at line 89 (`'actionEditGraphic applies an allowed edit end-to-end...'`) — keep the same setup, change only the assertions after the call:

```js
  const result = await actionEditGraphic('phone-5', 'img_1', { cta: '20% off' }, { sendImage });

  assert.deepEqual(result, { status: 'success', productName: 'Croma Earbuds', changes: { cta: '20% off' } });
  assert.equal(sentCalls.length, 1);
  assert.equal(sentCalls[0].to, 'phone-5');
  assert.equal(sentCalls[0].link, 'https://example.com/thumb.png');

  const image = findTrackedImage('phone-5', 'img_1');
  assert.deepEqual(image.currentEdits, { cta: '20% off' });
```

Replace the test at line 118 (`'actionEditGraphic returns a friendly message and does not record the edit when generation fails'`) — keep setup, change assertions:

```js
  const result = await actionEditGraphic('phone-6', 'img_1', { cta: '20% off' }, { sendImage });

  assert.equal(result.status, 'api_error');
  assert.equal(result.reason, 'generate_failed');
  assert.equal(sendImageCalled, false);

  const image = findTrackedImage('phone-6', 'img_1');
  assert.deepEqual(image.currentEdits, {});
```

Replace the test at line 135 (`'actionEditGraphic tells the user delivery failed but keeps the recorded edit when sendImage throws'`) — keep setup, change assertions:

```js
  const result = await actionEditGraphic('phone-7', 'img_1', { cta: '20% off' }, { sendImage });

  assert.equal(result.status, 'delivery_failed');
  assert.deepEqual(result.changes, { cta: '20% off' });

  const image = findTrackedImage('phone-7', 'img_1');
  assert.deepEqual(image.currentEdits, { cta: '20% off' });
```

- [ ] **Step 2: Add new tests for the lookup-failure status and the generalized discount cap**

Add to `src/actions.test.js`, after the tests updated in Step 1:

```js
test('actionEditGraphic returns an api_error/lookup_failed status when getTaggedDocument fails', async () => {
  writeFixtureCatalog([{ id: 'img_1', name: 'Croma Earbuds', docId: 'urn:doc:1' }]);
  expressApi.getTaggedDocument = async () => { throw new Error('getTaggedDocument failed 500: boom'); };

  const result = await actionEditGraphic('phone-8', 'img_1', { cta: '20% off' }, { sendImage: async () => {} });

  assert.equal(result.status, 'api_error');
  assert.equal(result.reason, 'lookup_failed');
});

const TV_ELEMENTS_DOC = {
  documentPages: [
    {
      pageNumber: 1,
      taggedElements: [
        { name: 'productImage', type: 'image', value: '' },
        { name: 'oldPrice', type: 'text', value: '' },
        { name: 'price', type: 'text', value: '' },
      ],
    },
  ],
};

test('actionEditGraphic rejects a price edit implying more than 40% off and makes no generate call', async () => {
  writeFixtureCatalog([{ id: 'img_2', name: 'TV Product', docId: 'urn:doc:2' }]);
  expressApi.getTaggedDocument = async () => TV_ELEMENTS_DOC;
  expressApi.generateVariation = async () => { throw new Error('should not be called'); };
  recordEdits('phone-9', 'img_2', { productImage: 'https://example.com/tv.png', oldPrice: 33999, price: 27199 });

  const result = await actionEditGraphic('phone-9', 'img_2', { price: 17000 }, { sendImage: async () => {} });

  assert.equal(result.status, 'discount_capped');
  assert.equal(result.maxPercent, 40);
});

test('actionEditGraphic applies a price edit at exactly the 40% cap (within rounding tolerance)', async () => {
  writeFixtureCatalog([{ id: 'img_2', name: 'TV Product', docId: 'urn:doc:2' }]);
  expressApi.getTaggedDocument = async () => TV_ELEMENTS_DOC;
  expressApi.generateVariation = async (docId, tagMappings) => {
    assert.deepEqual(tagMappings, { productImage: 'https://example.com/tv.png', oldPrice: 33999, price: 20399 });
    return { jobId: 'job-2', statusUrl: 'https://express-api.adobe.io/status/job-2' };
  };
  expressApi.pollJobStatus = async () => ({ status: 'succeeded', document: { thumbnailUrl: 'https://example.com/thumb2.png' } });
  recordEdits('phone-10', 'img_2', { productImage: 'https://example.com/tv.png', oldPrice: 33999, price: 27199 });

  const result = await actionEditGraphic('phone-10', 'img_2', { price: 20399 }, { sendImage: async () => {} });

  assert.equal(result.status, 'success');
  assert.deepEqual(result.changes, { price: 20399 });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm test 2>&1 | grep -A3 "actionEditGraphic"`
Expected: FAIL — the updated/new tests fail because `editExpressDesign` still returns strings and has no discount-cap generalization yet.

- [ ] **Step 4: Implement the generalized cap and structured outcomes in `src/actions.js`**

Add these two helpers directly after the existing `parsePercent` function (after line 63):

```js
const ROUNDING_TOLERANCE_PERCENT = 0.5;

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
```

Replace the whole `editExpressDesign` function (`src/actions.js:204-260`) with:

```js
async function editExpressDesign(phoneNumber, image, edits, { sendImage }) {
  let elements;
  try {
    const doc = await expressApi.getTaggedDocument(image.docId);
    elements = expressApi.collectTaggedElements(doc);
  } catch (err) {
    console.error('[editExpressDesign] Express API error', { docId: image.docId, message: err.message });
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
      allowedSummary: expressApi.formatAllowedEdits(image.name, elementsWithCurrentEdits),
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

  const pages = expressApi.pagesForEdits(elements, Object.keys(mergedEdits));
  const preferredDocumentName = expressApi.buildPreferredDocumentName(image.name);

  let thumbnailUrl;
  try {
    const { statusUrl } = await expressApi.generateVariation(image.docId, mergedEdits, pages, preferredDocumentName);
    const result = await expressApi.pollJobStatus(statusUrl);
    thumbnailUrl = result.document.thumbnailUrl;
    console.log('[edit:express] resolved image', { imageId: image.id, docId: image.docId, thumbnailUrl });
  } catch (err) {
    console.error('[editExpressDesign] generate/poll error', { docId: image.docId, message: err.message });
    return { status: 'api_error', productName: image.name, reason: 'generate_failed' };
  }

  recordEdits(phoneNumber, image.id, edits);

  try {
    await sendImage(phoneNumber, thumbnailUrl);
  } catch (err) {
    console.error('[editExpressDesign] sendImage error', { docId: image.docId, message: err.message });
    return { status: 'delivery_failed', productName: image.name, changes: edits };
  }

  return { status: 'success', productName: image.name, changes: edits };
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test 2>&1 | tail -20`
Expected: PASS — `# fail 0`.

- [ ] **Step 6: Commit**

```bash
git add src/actions.js src/actions.test.js
git commit -m "Generalize discount cap to price edits and return structured edit outcomes"
```

---

### Task 2: Fixed Edit Product/Discount/Price menu for Express-catalog images

**Files:**
- Modify: `src/actions.js:144-175` (`actionCheckAllowedEdits`)
- Modify: `src/actions.js:268-275` (`module.exports`)
- Test: `src/actions.test.js:1-73` (remove 2 obsolete tests, add 2 new ones)

**Interfaces:**
- Consumes: `findTrackedImage`, `parseEditOptionId` (test-only import), `expressApi.buildEditOptions`/`formatAllowedEdits` (unchanged, still used for the local-design branch only).
- Produces: `buildTopLevelEditOptions(imageId)` → `{ type: 'edit_options', bodyText: 'What would you like to change?', options: [{id, title}, ...], historyText }`, newly exported from `actions.js`. `actionCheckAllowedEdits` returns this directly for `source: 'express'` images (no Express API call), and its previous local-design branch is unchanged.

- [ ] **Step 1: Update `src/actions.test.js` — remove obsolete Express-branch tests, add new fixed-menu tests**

Delete these three tests entirely (lines 29-72): `'actionCheckAllowedEdits lists the tagged elements for a known image'`, `'actionCheckAllowedEdits shows the latest edited value instead of the stale original document value'`, `'actionCheckAllowedEdits returns a friendly message when the Express API call fails'`. (They tested behavior — inspecting the real tagged document to build the menu — that no longer exists for Express-catalog images once the menu is fixed. Task 1's `lookup_failed` test already covers the "Express API fails" case, but now on `actionEditGraphic`, not `actionCheckAllowedEdits`.)

Keep `'actionCheckAllowedEdits reports unknown images without throwing'` (lines 55-61) unchanged.

Add these two tests in its place, and update the import line at the top of the file to include `buildTopLevelEditOptions`:

```js
const { actionCheckAllowedEdits, actionEditGraphic, actionSelectTvModel, buildTopLevelEditOptions } = require('./actions');
```

```js
test('actionCheckAllowedEdits returns the fixed Edit Product/Discount/Price menu for an Express-catalog image, without calling the Express API', async () => {
  writeFixtureCatalog([{ id: 'img_1', name: 'Croma Earbuds', docId: 'urn:doc:1' }]);
  expressApi.getTaggedDocument = async () => { throw new Error('should not be called'); };

  const reply = await actionCheckAllowedEdits('phone-1', 'img_1');

  assert.equal(reply.type, 'edit_options');
  assert.equal(reply.bodyText, 'What would you like to change?');
  assert.deepEqual(reply.options, [
    { id: 'edit:img_1:product', title: 'Edit Product' },
    { id: 'edit:img_1:discount', title: 'Edit Discount' },
    { id: 'edit:img_1:price', title: 'Edit Price' },
  ]);
  assert.match(reply.historyText, /Edit Product/);
});

test('buildTopLevelEditOptions ids parse back to the "product"/"discount"/"price" bare fields', () => {
  const { options } = buildTopLevelEditOptions('img_1');

  assert.deepEqual(
    options.map((option) => parseEditOptionId(option.id)),
    [
      { imageId: 'img_1', fieldName: 'product' },
      { imageId: 'img_1', fieldName: 'discount' },
      { imageId: 'img_1', fieldName: 'price' },
    ]
  );
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test 2>&1 | grep -B2 -A6 "fixed Edit Product"`
Expected: FAIL — `buildTopLevelEditOptions` is not exported yet and `actionCheckAllowedEdits` still calls the Express API.

- [ ] **Step 3: Implement `buildTopLevelEditOptions` and wire it into `actionCheckAllowedEdits`**

Add above `actionCheckAllowedEdits` (before line 144):

```js
const TOP_LEVEL_EDIT_FIELDS = [
  { fieldName: 'product', title: 'Edit Product' },
  { fieldName: 'discount', title: 'Edit Discount' },
  { fieldName: 'price', title: 'Edit Price' },
];

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
```

Replace the body of `actionCheckAllowedEdits` (`src/actions.js:144-175`) with:

```js
async function actionCheckAllowedEdits(phoneNumber, imageId) {
  const image = findTrackedImage(phoneNumber, imageId);
  console.log('[action:check_allowed_edits]', { phoneNumber, imageId, source: image?.source ?? 'not_found' });
  if (!image) {
    return formatUnknownImageMessage(phoneNumber);
  }

  if (image.source === 'express') {
    return buildTopLevelEditOptions(imageId);
  }

  const elements = localEditElements(image);
  return {
    type: 'edit_options',
    bodyText: 'What would you like to change?',
    options: expressApi.buildEditOptions(elements, imageId),
    historyText: expressApi.formatAllowedEdits(image.name, elements),
  };
}
```

Add `buildTopLevelEditOptions` to `module.exports` (`src/actions.js:268-275`):

```js
module.exports = {
  actionListCampaignGraphics,
  actionCreateDesign,
  actionCheckAllowedEdits,
  actionEditGraphic,
  actionGenerateBulkGraphics,
  actionSelectTvModel,
  buildTopLevelEditOptions,
};
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test 2>&1 | tail -20`
Expected: PASS — `# fail 0`.

- [ ] **Step 5: Commit**

```bash
git add src/actions.js src/actions.test.js
git commit -m "Replace dynamic edit menu with fixed Edit Product/Discount/Price for Express-catalog images"
```

---

### Task 3: Product picker copy — "Which product do you want?" + "Choose product" button

**Files:**
- Modify: `src/actions.js:177-186` (`actionSelectTvModel`)
- Test: `src/actions.test.js:152-178` (update one test)

**Interfaces:**
- Consumes: `buildValueEditId` (unchanged), `TV_MODEL_TITLES`, `TV_MODEL_EDITS` (unchanged constants).
- Produces: `actionSelectTvModel(imageId)` now also returns `buttonText: 'Choose product'`, and `bodyText` changes from `'Which model would you like to use?'` to `'Which product do you want?'`. This `buttonText` field is what Task 4's `sendEditOptions` uses to decide to send a WhatsApp list instead of buttons.

- [ ] **Step 1: Update the existing test**

Replace `'actionSelectTvModel returns the 3 fixed TV model options with the question body text'` (`src/actions.test.js:152-162`):

```js
test('actionSelectTvModel returns the 3 fixed TV model options with a list-picker body text and button', () => {
  const result = actionSelectTvModel('img_1');

  assert.equal(result.type, 'edit_options');
  assert.equal(result.bodyText, 'Which product do you want?');
  assert.equal(result.buttonText, 'Choose product');
  assert.equal(result.options.length, 3);
  assert.deepEqual(
    result.options.map((option) => option.title),
    ['Sony Bravia K-75', 'LG UA82 AI', 'Samsung UA4']
  );
});
```

Leave `'actionSelectTvModel encodes the same fixed productImage/oldPrice/price edits into every option id'` unchanged.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test 2>&1 | grep -A6 "list-picker body text"`
Expected: FAIL — actual `bodyText` is still `'Which model would you like to use?'` and `buttonText` is `undefined`.

- [ ] **Step 3: Implement**

Replace `actionSelectTvModel` (`src/actions.js:177-186`):

```js
function actionSelectTvModel(imageId) {
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test 2>&1 | tail -20`
Expected: PASS — `# fail 0`.

- [ ] **Step 5: Commit**

```bash
git add src/actions.js src/actions.test.js
git commit -m "Present TV model picker as a list with Choose product button"
```

---

### Task 4: WhatsApp list-message support in `app.js`

**Files:**
- Modify: `src/app.js:83-96` (`sendEditOptions`, new `sendList`)

**Interfaces:**
- Consumes: `whatsappPost` (existing), the `buttonText` field added to `actionSelectTvModel`'s result in Task 3.
- Produces: `sendList(to, { bodyText, buttonText, options })` — new. `sendEditOptions(to, result)` now branches: list when `result.buttonText` is present, otherwise the existing button-chunking behavior (used by the Task 2 fixed 3-option menu, which has no `buttonText`).

No automated tests for this step — see Global Constraints (`app.js` isn't unit-testable without an `OPENAI_API_KEY` and starts a server on load). It's verified in Task 6's manual/simulated webhook check.

- [ ] **Step 1: Add `sendList` and update `sendEditOptions`**

Insert a new function directly after `sendButtons` (`src/app.js:81`, before the `BUTTONS_PER_MESSAGE` comment):

```js
// WhatsApp list messages: a single "menu" button plus up to 10 rows in one section.
function sendList(to, { bodyText, buttonText, options }) {
  return whatsappPost({
    messaging_product: 'whatsapp',
    to,
    type: 'interactive',
    interactive: {
      type: 'list',
      body: { text: bodyText },
      action: {
        button: buttonText,
        sections: [{ rows: options.map((option) => ({ id: option.id, title: option.title })) }],
      },
    },
  });
}
```

Replace `sendEditOptions` (`src/app.js:87-96`):

```js
async function sendEditOptions(to, result) {
  const { bodyText, options, buttonText } = result;
  if (options.length === 0) {
    await sendText(to, bodyText);
    return;
  }
  if (buttonText) {
    await sendList(to, { bodyText, buttonText, options });
    return;
  }
  for (let i = 0; i < options.length; i += BUTTONS_PER_MESSAGE) {
    const chunk = options.slice(i, i + BUTTONS_PER_MESSAGE);
    await sendButtons(to, i === 0 ? bodyText : 'More edits:', chunk);
  }
}
```

- [ ] **Step 2: Run the full test suite to confirm no regressions**

Run: `npm test 2>&1 | tail -20`
Expected: PASS — `# fail 0` (this task touches no tested code paths; this just guards against a typo breaking something else).

- [ ] **Step 3: Commit**

```bash
git add src/app.js
git commit -m "Add WhatsApp list-message support for the product picker"
```

---

### Task 5: Dynamic, language-mirrored replies + bare-field GPT routing + menu resurfacing

**Files:**
- Modify: `src/app.js:1-12` (imports)
- Modify: `src/app.js:210-247` (`decideAction` — images list, system prompt)
- Modify: `src/app.js:313-337` (dispatch: `check_allowed_edits` unaffected structurally, `edit_graphic` case rewritten)
- New: `phraseOutcome` function in `src/app.js`

**Interfaces:**
- Consumes: `buildTopLevelEditOptions` (Task 2, imported from `./actions`), `actionEditGraphic`'s new return contract (Task 1: string for local, structured object for express), `image.currentEdits` (existing, from `getTrackedImages`).
- Produces: `phraseOutcome(phoneNumber, userMessage, outcome)` — new, not exported (only used within `app.js`'s dispatch).

No automated tests for this step — see Global Constraints. Verified in Task 6.

- [ ] **Step 1: Import `buildTopLevelEditOptions`**

In `src/app.js:4-11`, change:

```js
const {
  actionListCampaignGraphics,
  actionCreateDesign,
  actionCheckAllowedEdits,
  actionEditGraphic,
  actionGenerateBulkGraphics,
  actionSelectTvModel,
} = require('./actions');
```

to:

```js
const {
  actionListCampaignGraphics,
  actionCreateDesign,
  actionCheckAllowedEdits,
  actionEditGraphic,
  actionGenerateBulkGraphics,
  actionSelectTvModel,
  buildTopLevelEditOptions,
} = require('./actions');
```

- [ ] **Step 2: Show current field values in the images list, and add the bare-field routing + discount-computation rules to the system prompt**

In `decideAction` (`src/app.js:210-247`), replace the `imagesList` line and the system prompt string.

Replace:

```js
  const trackedImages = getTrackedImages(phoneNumber);
  const imagesList = trackedImages.map((image) => `- ${image.id}: ${image.name}`).join('\n');
```

with:

```js
  const trackedImages = getTrackedImages(phoneNumber);
  const imagesList = trackedImages
    .map((image) => `- ${image.id}: ${image.name}${formatCurrentEdits(image.currentEdits)}`)
    .join('\n');
```

Add this helper function directly above `decideAction` (before line 210):

```js
function formatCurrentEdits(currentEdits) {
  const entries = Object.entries(currentEdits || {});
  if (entries.length === 0) return '';
  return ` (${entries.map(([key, value]) => `${key}: ${value}`).join(', ')})`;
}
```

In the system prompt template string (`src/app.js:218-229`), insert this new paragraph immediately before the final `Images previously sent to this user (reference by id):` line:

```
When the user taps a menu option for "product", "discount", or "price" (from the fixed Edit Product/Edit Discount/Edit Price menu on an Express-catalog graphic):
- "product": call select_tv_model.
- "discount" or "price" with no value given yet: call ask_for_more_information asking what they'd like the new discount or price to be.
- "discount" WITH a value (a percentage, in English, Hindi, or Hinglish — e.g. "50%", "discount ko 50% kar do", "40% off"): compute the new price yourself as oldPrice × (1 − discountPercent / 100), rounded to the nearest whole number, using the oldPrice shown in the images list below, then call edit_graphic with only { "price": <computed value> } — never change oldPrice.
- "price" WITH a value: call edit_graphic with { "price": <value> } directly, no computation needed.
```

- [ ] **Step 3: Add `phraseOutcome`**

Add this function directly after `decideAction` (after line 247, before the `// ── Webhook routes ──` comment):

```js
// Turns a structured edit outcome into the actual WhatsApp reply text, matching
// the user's language/style (English or Hinglish) rather than a fixed template.
async function phraseOutcome(phoneNumber, userMessage, outcome) {
  const response = await openai.chat.completions.create({
    model: openaiModel,
    messages: [
      {
        role: 'system',
        content: `You are a WhatsApp assistant. Given the outcome below, write a short reply to the user. Match the user's language and style — if their message was Hinglish (romanized Hindi mixed with English), reply in Hinglish; otherwise reply in English. Don't invent facts beyond the outcome given.

Examples of the tone/style to match:
- Success (English): "I have updated product, with price & discount"
- Success (Hinglish): "Maine discount aur price updated kar diya hai"
- Capped (Hinglish): "Iss product pr maximum 40% discount de sakte hain"`,
      },
      { role: 'user', content: `User message: ${userMessage}\nOutcome: ${JSON.stringify(outcome)}` },
    ],
  });

  return response.choices[0].message.content;
}
```

- [ ] **Step 4: Rewrite the `edit_graphic` dispatch case**

Replace the `case 'edit_graphic':` block (`src/app.js:334-337`):

```js
        case 'edit_graphic':
          await sendText(phoneNumber, '⏳ Applying edits to your graphic...');
          replyText = await actionEditGraphic(phoneNumber, args.image_id, args.edits, { sendImage });
          break;
```

with:

```js
        case 'edit_graphic': {
          await sendText(phoneNumber, '⏳ Applying edits to your graphic...');
          const result = await actionEditGraphic(phoneNumber, args.image_id, args.edits, { sendImage });
          if (typeof result === 'string') {
            replyText = result;
          } else {
            replyText = await phraseOutcome(phoneNumber, userText, result);
            await sendText(phoneNumber, replyText);
            await sendEditOptions(phoneNumber, buildTopLevelEditOptions(args.image_id));
            skipSend = true;
          }
          break;
        }
```

- [ ] **Step 5: Run the full test suite to confirm no regressions**

Run: `npm test 2>&1 | tail -20`
Expected: PASS — `# fail 0` (no test file exercises `app.js`, so this step is a syntax/regression guard for the rest of the suite).

- [ ] **Step 6: Commit**

```bash
git add src/app.js
git commit -m "Add GPT-phrased, language-mirrored edit replies and bare-field discount/price routing"
```

---

### Task 6: Manual/simulated webhook verification of the full script

**Files:** none (verification only)

**Interfaces:** none — this task exercises the running app end-to-end via simulated webhook POST bodies, the same way prior features in this repo (e.g. the TV product-swap design) were manually verified before merge.

- [ ] **Step 1: Start the app with required env vars**

Run (fill in real values or test-double values for `WHATSAPP_TOKEN`/`OPENAI_API_KEY` per your local `.env` setup):

```bash
npm start
```

Expected: `Listening on port 3000` with no startup errors.

- [ ] **Step 2: Simulate each turn of the script as a webhook POST**

For each user turn below, POST a WhatsApp-shaped webhook body to `http://localhost:3000/` (a `text` message for free-text turns, an `interactive.button_reply`/`interactive.list_reply` for tap turns) and confirm the described bot behavior in the server logs / connected WhatsApp test number:

1. "I want to edit this" (text) → 3-button menu: Edit Product / Edit Discount / Edit Price.
2. Tap "Edit Product" → WhatsApp **list** message "Which product do you want?" with "Choose product" button, 3 rows (Sony Bravia K-75 / LG UA82 AI / Samsung UA4).
3. Tap "Sony Bravia K-75" → image updated to the Sony placeholder, oldPrice 33999 / price 27199 applied; phrased confirmation text sent; 3-button menu resent.
4. "discount ko 50% kar do" (text, Hinglish) → no image sent; a Hinglish denial mentioning the 40% cap; 3-button menu resent.
5. "Theek h, 40% hi kar do" (text, Hinglish) → image updated (price 20399, oldPrice unchanged 33999); Hinglish confirmation; 3-button menu resent.

Expected: each step's bot behavior matches the description above. Exact reply wording will vary turn to turn (GPT-generated) — verify meaning and language register, not literal text.

- [ ] **Step 3: Report results**

If any step diverges from the expected behavior, note which step and the actual vs. expected outcome before proceeding — do not mark this task done with an unresolved mismatch.
