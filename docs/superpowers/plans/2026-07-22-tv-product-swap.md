# TV Product-Swap Quick-Reply Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a user asks to change the product in a graphic to a TV, show 3 quick-reply model buttons, and tapping one immediately applies `productImage`/`oldPrice`/`price` via the real Adobe Express edit pipeline — no follow-up question needed.

**Architecture:** Extract the existing "interactive reply id" encode/parse logic out of `app.js` into a new small pure module (`src/interactiveReply.js`) so it's unit-testable and reusable, extend it to support fully-specified multi-field edits (JSON-encoded in the id, since the image URL contains a literal `=`), add a new `select_tv_model` GPT tool + `actionSelectTvModel` handler that reuses the existing `sendEditOptions` button-rendering path, and let the existing `edit_graphic` tool + `actionEditGraphic` validation handle the rest unchanged.

**Tech Stack:** Node.js, `node:test` + `node:assert/strict` (existing test runner, no new dependencies), Express, OpenAI SDK (tool-calling), WhatsApp Cloud API.

## Global Constraints

- No new npm dependencies — use `node:test`/`node:assert/strict` exactly like every existing `*.test.js` file.
- `app.js` cannot be `require()`'d from a test file — it calls `app.listen(port)` at module load time with no test guard, so any logic that needs unit tests must live in a module that doesn't import `app.js`.
- All 3 TV model buttons apply the exact same fixed edits for now: `{ productImage: 'https://s7ap1.scene7.com/is/image/healthmonitor/SonyTv?wid=1000', oldPrice: 33999, price: 27199 }` — not per-model values.
- Model titles, verbatim: `Sony Bravia K-75`, `LG UA82 AI`, `Samsung UA4`.
- Question body text, verbatim: `Which model would you like to use?`
- Keep using the existing `edit_graphic`/`actionEditGraphic` validation path for applying the edit — do not duplicate or bypass its allowed-tag-name check.

---

### Task 1: Extract interactive-reply id parsing into a testable module

**Files:**
- Create: `src/interactiveReply.js`
- Create: `src/interactiveReply.test.js`
- Modify: `src/app.js:95-110` (remove the two functions being extracted), `src/app.js:1-9` (add require), `src/app.js:252-253` (use the imported function — no logic change)

**Interfaces:**
- Produces: `parseEditOptionId(id: string) => { imageId: string, fieldName: string } | null` (same behavior as today), `messageTextForInteractiveReply(reply: { id: string, title: string }) => string` (same behavior as today).

This task is a pure refactor — behavior must not change. It exists so Task 2 can extend this logic with real unit tests, since `app.js` itself can't be safely required in a test file (see Global Constraints).

- [ ] **Step 1: Write the failing test file**

Create `src/interactiveReply.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseEditOptionId, messageTextForInteractiveReply } = require('./interactiveReply');

test('parseEditOptionId parses a bare field-only id', () => {
  const parsed = parseEditOptionId('edit:img_1:heading');
  assert.deepEqual(parsed, { imageId: 'img_1', fieldName: 'heading' });
});

test('parseEditOptionId returns null for an id with no edit: prefix', () => {
  assert.equal(parseEditOptionId('something_else'), null);
});

test('parseEditOptionId returns null for an id missing the field separator', () => {
  assert.equal(parseEditOptionId('edit:img_1'), null);
});

test('parseEditOptionId returns null for a non-string id', () => {
  assert.equal(parseEditOptionId(undefined), null);
});

test('messageTextForInteractiveReply builds a change-field message for a bare field id', () => {
  const text = messageTextForInteractiveReply({ id: 'edit:img_1:heading', title: 'Change heading' });
  assert.equal(text, 'I\'d like to change "heading" on image img_1.');
});

test('messageTextForInteractiveReply falls back to the title when the id is unparseable', () => {
  const text = messageTextForInteractiveReply({ id: 'not-an-edit-id', title: 'Some Title' });
  assert.equal(text, 'Some Title');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test src/interactiveReply.test.js`
Expected: FAIL — `Cannot find module './interactiveReply'`

- [ ] **Step 3: Create the module by moving the existing logic out of app.js**

Create `src/interactiveReply.js`:

```js
// Edit option button/list-row ids are `edit:${imageId}:${fieldName}` (see
// expressApi.buildEditOptions). Parse that back out so a tap can tell GPT exactly
// which image and field the user picked, instead of only the truncated button title.
function parseEditOptionId(id) {
  if (typeof id !== 'string' || !id.startsWith('edit:')) return null;
  const rest = id.slice('edit:'.length);
  const separatorIndex = rest.indexOf(':');
  if (separatorIndex === -1) return null;
  return { imageId: rest.slice(0, separatorIndex), fieldName: rest.slice(separatorIndex + 1) };
}

function messageTextForInteractiveReply(reply) {
  const parsed = parseEditOptionId(reply.id);
  if (!parsed) return reply.title;
  return `I'd like to change "${parsed.fieldName}" on image ${parsed.imageId}.`;
}

module.exports = { parseEditOptionId, messageTextForInteractiveReply };
```

Now remove the two functions from `app.js:95-110` (the block starting with the `// Edit option button/list-row ids are...` comment and ending after the `messageTextForInteractiveReply` function), and instead require them at the top. Change `src/app.js:3-9` from:

```js
const { getTrackedImages } = require('./imageStore');
const {
  actionListCampaignGraphics,
  actionCheckAllowedEdits,
  actionEditGraphic,
  actionGenerateBulkGraphics,
} = require('./actions');
```

to:

```js
const { getTrackedImages } = require('./imageStore');
const {
  actionListCampaignGraphics,
  actionCheckAllowedEdits,
  actionEditGraphic,
  actionGenerateBulkGraphics,
} = require('./actions');
const { parseEditOptionId, messageTextForInteractiveReply } = require('./interactiveReply');
```

`app.js:252-253` (the webhook loop) is unchanged — it already just calls `messageTextForInteractiveReply(interactiveReply)`, which now resolves to the imported function instead of a local one. `parseEditOptionId` is imported for use in Task 4's wiring even though nothing in `app.js` calls it directly yet after this task.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test src/interactiveReply.test.js`
Expected: PASS (6 tests)

- [ ] **Step 5: Run the full suite to confirm nothing else broke**

Run: `node --test src/`
Expected: same pass/fail counts as before this task (32 pass, 2 pre-existing unrelated failures in `actions.test.js` — see Note below)

> **Note:** `src/actions.test.js` has 2 pre-existing failing tests (`actionCheckAllowedEdits lists the tagged elements...` and `...shows the latest edited value...`) unrelated to this plan — they assert `reply` is a string, but `actionCheckAllowedEdits` has returned an object since an earlier commit. Do not fix them as part of this plan; just confirm the count doesn't change.

- [ ] **Step 6: Commit**

```bash
git add src/interactiveReply.js src/interactiveReply.test.js src/app.js
git commit -m "Extract interactive-reply id parsing into a testable module"
```

---

### Task 2: Support fully-specified multi-field edits in interactive reply ids

**Files:**
- Modify: `src/interactiveReply.js`
- Modify: `src/interactiveReply.test.js`

**Interfaces:**
- Consumes: nothing new.
- Produces: `buildValueEditId(imageId: string, edits: object) => string`, `parseEditOptionId` now also returns `{ imageId: string, edits: object }` (no `fieldName`) when the id encodes a full edits object, `messageTextForInteractiveReply` now also handles that shape. Task 3 (`actionSelectTvModel`) calls `buildValueEditId`. Task 4 (`app.js` webhook wiring) relies on `parseEditOptionId`/`messageTextForInteractiveReply` handling both shapes transparently — no change needed in `app.js` for this task.

- [ ] **Step 1: Write the failing tests**

Add to `src/interactiveReply.test.js`:

```js
const { buildValueEditId, parseEditOptionId, messageTextForInteractiveReply } = require('./interactiveReply');

test('buildValueEditId round-trips through parseEditOptionId', () => {
  const edits = { productImage: 'https://s7ap1.scene7.com/is/image/healthmonitor/SonyTv?wid=1000', oldPrice: 33999, price: 27199 };
  const id = buildValueEditId('img_1', edits);
  const parsed = parseEditOptionId(id);
  assert.deepEqual(parsed, { imageId: 'img_1', edits });
});

test('parseEditOptionId still parses a bare field-only id after the value-edit change', () => {
  const parsed = parseEditOptionId('edit:img_1:heading');
  assert.deepEqual(parsed, { imageId: 'img_1', fieldName: 'heading' });
});

test('messageTextForInteractiveReply lists every field/value for a fully-specified edit id', () => {
  const id = buildValueEditId('img_1', { productImage: 'https://example.com/tv.png', oldPrice: 33999, price: 27199 });
  const text = messageTextForInteractiveReply({ id, title: 'Sony Bravia K-75' });
  assert.equal(
    text,
    'I\'d like to change "productImage" to "https://example.com/tv.png", "oldPrice" to "33999", "price" to "27199" on image img_1.'
  );
});
```

(Update the existing `require` at the top of the test file to include `buildValueEditId` in the destructure — one `require` line covering all four exports is fine.)

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `node --test src/interactiveReply.test.js`
Expected: FAIL — `buildValueEditId is not a function` (and the round-trip/message tests fail too)

- [ ] **Step 3: Implement the extension**

Replace the contents of `src/interactiveReply.js` with:

```js
const EDIT_ID_PREFIX = 'edit:';

// Edit option button/list-row ids are `edit:${imageId}:${fieldName}` (bare field —
// see expressApi.buildEditOptions) or `edit:${imageId}:${encodeURIComponent(JSON.stringify(edits))}`
// (fully-specified — see actions.buildTvModelOptions) — parse either shape back out so
// a tap can tell GPT exactly what to do instead of only the truncated button title.
function buildValueEditId(imageId, edits) {
  return `${EDIT_ID_PREFIX}${imageId}:${encodeURIComponent(JSON.stringify(edits))}`;
}

function parseEditOptionId(id) {
  if (typeof id !== 'string' || !id.startsWith(EDIT_ID_PREFIX)) return null;
  const rest = id.slice(EDIT_ID_PREFIX.length);
  const separatorIndex = rest.indexOf(':');
  if (separatorIndex === -1) return null;
  const imageId = rest.slice(0, separatorIndex);
  const remainder = rest.slice(separatorIndex + 1);

  try {
    const decoded = JSON.parse(decodeURIComponent(remainder));
    if (decoded && typeof decoded === 'object' && !Array.isArray(decoded)) {
      return { imageId, edits: decoded };
    }
  } catch {
    // Not JSON — remainder is a bare field name, handled below.
  }

  return { imageId, fieldName: remainder };
}

function describeEdits(edits) {
  return Object.entries(edits)
    .map(([key, value]) => `"${key}" to "${value}"`)
    .join(', ');
}

function messageTextForInteractiveReply(reply) {
  const parsed = parseEditOptionId(reply.id);
  if (!parsed) return reply.title;
  if (parsed.edits) {
    return `I'd like to change ${describeEdits(parsed.edits)} on image ${parsed.imageId}.`;
  }
  return `I'd like to change "${parsed.fieldName}" on image ${parsed.imageId}.`;
}

module.exports = { buildValueEditId, parseEditOptionId, messageTextForInteractiveReply };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test src/interactiveReply.test.js`
Expected: PASS (9 tests)

- [ ] **Step 5: Run the full suite**

Run: `node --test src/`
Expected: same as Task 1's Step 5 (no new failures)

- [ ] **Step 6: Commit**

```bash
git add src/interactiveReply.js src/interactiveReply.test.js
git commit -m "Support fully-specified multi-field edits in interactive reply ids"
```

---

### Task 3: Add the TV model options handler

**Files:**
- Modify: `src/actions.js`
- Modify: `src/actions.test.js`

**Interfaces:**
- Consumes: `buildValueEditId(imageId, edits)` from `./interactiveReply` (Task 2).
- Produces: `actionSelectTvModel(imageId) => { type: 'edit_options', bodyText: string, options: Array<{ id: string, title: string }> }` (synchronous — no Express API call needed to build the fixed 3-option list). Task 4 (`app.js` webhook wiring) calls this and passes the result straight into the existing `sendEditOptions(phoneNumber, result)` — same shape `actionCheckAllowedEdits` already produces.

- [ ] **Step 1: Write the failing tests**

Add to `src/actions.test.js` (add `actionSelectTvModel` to the existing `require('./actions')` destructure, and add `parseEditOptionId` from `./interactiveReply` for assertions):

```js
const { actionCheckAllowedEdits, actionEditGraphic, actionSelectTvModel } = require('./actions');
const { parseEditOptionId } = require('./interactiveReply');

test('actionSelectTvModel returns the 3 fixed TV model options with the question body text', () => {
  const result = actionSelectTvModel('img_1');

  assert.equal(result.type, 'edit_options');
  assert.equal(result.bodyText, 'Which model would you like to use?');
  assert.equal(result.options.length, 3);
  assert.deepEqual(
    result.options.map((option) => option.title),
    ['Sony Bravia K-75', 'LG UA82 AI', 'Samsung UA4']
  );
});

test('actionSelectTvModel encodes the same fixed productImage/oldPrice/price edits into every option id', () => {
  const result = actionSelectTvModel('img_1');

  for (const option of result.options) {
    const parsed = parseEditOptionId(option.id);
    assert.deepEqual(parsed, {
      imageId: 'img_1',
      edits: {
        productImage: 'https://s7ap1.scene7.com/is/image/healthmonitor/SonyTv?wid=1000',
        oldPrice: 33999,
        price: 27199,
      },
    });
  }
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test src/actions.test.js`
Expected: FAIL — `actionSelectTvModel is not a function`

- [ ] **Step 3: Implement `actionSelectTvModel`**

In `src/actions.js`, add near the top (after the existing `require`s at `src/actions.js:1-2`):

```js
const { buildValueEditId } = require('./interactiveReply');

const TV_PLACEHOLDER_IMAGE_URL = 'https://s7ap1.scene7.com/is/image/healthmonitor/SonyTv?wid=1000';
const TV_MODEL_TITLES = ['Sony Bravia K-75', 'LG UA82 AI', 'Samsung UA4'];
const TV_MODEL_EDITS = { productImage: TV_PLACEHOLDER_IMAGE_URL, oldPrice: 33999, price: 27199 };
```

Then add the function itself (near `actionCheckAllowedEdits`, e.g. directly after it):

```js
function actionSelectTvModel(imageId) {
  return {
    type: 'edit_options',
    bodyText: 'Which model would you like to use?',
    options: TV_MODEL_TITLES.map((title) => ({
      id: buildValueEditId(imageId, TV_MODEL_EDITS),
      title,
    })),
  };
}
```

Finally, add `actionSelectTvModel` to `module.exports` at the bottom of `src/actions.js`:

```js
module.exports = {
  actionListCampaignGraphics,
  actionCheckAllowedEdits,
  actionEditGraphic,
  actionGenerateBulkGraphics,
  actionSelectTvModel,
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test src/actions.test.js`
Expected: PASS for the 2 new tests (the 2 pre-existing unrelated failures from Task 1's Note still fail — that's expected, don't touch them)

- [ ] **Step 5: Run the full suite**

Run: `node --test src/`
Expected: 34 pass, 2 pre-existing unrelated failures (same 2 as before — count of passing tests increases by 2 vs. Task 2's baseline)

- [ ] **Step 6: Commit**

```bash
git add src/actions.js src/actions.test.js
git commit -m "Add actionSelectTvModel handler for the TV product-swap quick replies"
```

---

### Task 4: Wire the `select_tv_model` GPT tool into the webhook

**Files:**
- Modify: `src/app.js`

**Interfaces:**
- Consumes: `actionSelectTvModel(imageId)` from `./actions` (Task 3).
- Produces: nothing new for later tasks — this is the last piece of wiring.

- [ ] **Step 1: Import `actionSelectTvModel`**

In `src/app.js:4-9`, change:

```js
const {
  actionListCampaignGraphics,
  actionCheckAllowedEdits,
  actionEditGraphic,
  actionGenerateBulkGraphics,
} = require('./actions');
```

to:

```js
const {
  actionListCampaignGraphics,
  actionCheckAllowedEdits,
  actionEditGraphic,
  actionGenerateBulkGraphics,
  actionSelectTvModel,
} = require('./actions');
```

- [ ] **Step 2: Add the `select_tv_model` tool definition**

In `src/app.js`, in the `tools` array (currently `src/app.js:114-184`), add a new entry. Insert it right after the `check_allowed_edits` tool definition (ends at `src/app.js:151`) and before `edit_graphic`:

```js
  {
    type: 'function',
    function: {
      name: 'select_tv_model',
      description:
        'Use when the user asks to change or set the product in a graphic to a TV, without specifying which model. Do not use this for edits to text fields or other product types — use edit_graphic for those.',
      parameters: {
        type: 'object',
        properties: {
          image_id: { type: 'string', description: 'The id of the image to edit, from the tracked images list' },
        },
        required: ['image_id'],
      },
    },
  },
```

- [ ] **Step 3: Handle the tool call in the webhook switch statement**

In `src/app.js`, the `switch (action)` block (currently `src/app.js:272-307`) has a `case 'check_allowed_edits':` block (`src/app.js:282-293`) that shows the pattern to follow — sending a placeholder text, calling the action, then rendering options via `sendEditOptions` and setting `skipSend = true`. Add a new case right after it:

```js
        case 'select_tv_model': {
          const result = actionSelectTvModel(args.image_id);
          await sendEditOptions(phoneNumber, result);
          replyText = result.bodyText;
          skipSend = true;
          break;
        }
```

(No "⏳ ..." placeholder text before this one — unlike `check_allowed_edits`/`edit_graphic`, it's synchronous and doesn't call the Express API, so there's nothing to wait on.)

- [ ] **Step 4: Run the full test suite**

Run: `node --test src/`
Expected: same pass/fail counts as Task 3's Step 5 (this task only touches `app.js`, which has no automated tests — see Global Constraints)

- [ ] **Step 5: Manual verification via a local script**

`app.js` can't be imported in a test, so verify the new wiring by exercising the pieces it composes directly in a scratch script. Run this with `node`:

```js
const { actionSelectTvModel, actionEditGraphic } = require('./src/actions');
const { parseEditOptionId, messageTextForInteractiveReply } = require('./src/interactiveReply');

// 1. Simulate GPT calling select_tv_model('img_1') after "change product to tv":
const result = actionSelectTvModel('img_1');
console.log('Options shown to user:', result.options);

// 2. Simulate the user tapping the first button — this is what the webhook receives:
const tappedReply = { id: result.options[0].id, title: result.options[0].title };

// 3. Simulate app.js turning that tap into a synthetic message for GPT:
console.log('Synthetic message sent to GPT:', messageTextForInteractiveReply(tappedReply));

// 4. Confirm parseEditOptionId recovers the exact edits object actionEditGraphic will receive:
console.log('Parsed edits:', parseEditOptionId(tappedReply.id));
```

Expected output:
- `Options shown to user` has 3 entries titled `Sony Bravia K-75`, `LG UA82 AI`, `Samsung UA4`.
- `Synthetic message sent to GPT` reads: `I'd like to change "productImage" to "https://s7ap1.scene7.com/is/image/healthmonitor/SonyTv?wid=1000", "oldPrice" to "33999", "price" to "27199" on image img_1.`
- `Parsed edits` is `{ imageId: 'img_1', edits: { productImage: '...', oldPrice: 33999, price: 27199 } }`.

This confirms the full chain (options → tap → synthetic GPT message → recovered edits) works end to end without needing a live WhatsApp/OpenAI/Express connection. The remaining link — GPT actually calling `edit_graphic` with this synthetic message, and `actionEditGraphic` calling the real Express API — is already covered by the existing `edit_graphic` system-prompt rule and `actions.test.js` coverage; it doesn't need TV-specific testing since nothing about it is TV-specific.

- [ ] **Step 6: Commit**

```bash
git add src/app.js
git commit -m "Wire select_tv_model GPT tool into the webhook handler"
```

---

## Post-plan check

After Task 4, run `node --test src/` one final time and confirm: the only failures are the 2 pre-existing ones already present before this plan started (`actionCheckAllowedEdits lists the tagged elements for a known image` and `actionCheckAllowedEdits shows the latest edited value instead of the stale original document value`). If any other test fails, stop and investigate before considering this plan done.
