# Design: "Change product to TV" quick-reply flow

## Goal

Support this WhatsApp conversation flow:

1. User asks to change the product in a graphic to a TV (e.g. "change product to tv"), without naming a specific model.
2. System asks "Which model would you like to use?" with 3 tappable quick-reply buttons: Sony Bravia K-75 / LG UA82 AI / Samsung UA4.
3. User taps one.
4. System immediately calls the Adobe Express API to apply all of: `productImage` → the TV's image, `oldPrice` → 33999, `price` → 27199. No further clarifying question — the tap alone is enough to act.
5. System sends the updated image, same as any other edit.

Scope is TV-only for now: one hardcoded trigger, one hardcoded list of 3 models, and (until real per-model assets exist) the same placeholder image URL and the same fixed `oldPrice`/`price` for all three buttons. Not designed as a general "product category" system — if a second category is needed later, this gets generalized then.

## New GPT tool

Added to the existing `tools` array in `app.js`, following the same shape as `check_allowed_edits`/`edit_graphic`:

```js
select_tv_model({ image_id })
```

Description: "Use when the user asks to change/set the product in a graphic to a TV, without specifying which model. Do not use this for edits to text fields — use edit_graphic for those." `image_id` is picked from the tracked-images list exactly like the other tools.

## Action handler

New `actionSelectTvModel(phoneNumber, imageId)` in `actions.js`, returning the same `{ type: 'edit_options', bodyText, options }` shape `actionCheckAllowedEdits` already returns, so it reuses `sendEditOptions` unchanged (3 options → one native button message, no "More edits" chunking).

```js
const TV_MODELS = [
  { title: 'Sony Bravia K-75' },
  { title: 'LG UA82 AI' },
  { title: 'Samsung UA4' },
];
const TV_PLACEHOLDER_IMAGE_URL = 'https://s7ap1.scene7.com/is/image/healthmonitor/SonyTv?wid=1000';
const TV_EDITS = { productImage: TV_PLACEHOLDER_IMAGE_URL, oldPrice: 33999, price: 27199 };
```

`bodyText`: `"Which model would you like to use?"`. Each option's `id` encodes the *full* edits object (not just a field name), since the tap must fully specify the change — see below.

No `findTrackedImage`/Express lookup is needed at this step (unlike `check_allowed_edits`, which reads the real tagged document to build its option list); the 3 buttons are fixed regardless of the document. Validation still happens later, for free, in `actionEditGraphic`.

## Button `id` encoding (extends the existing mechanism)

Today, edit-option button ids are `edit:<imageId>:<fieldName>` (bare field, no value — tapping always leads to a clarifying question, per `app.js` `parseEditOptionId`/`messageTextForInteractiveReply`).

The TV buttons need to carry a *value* too, and here it's actually multiple field/value pairs at once. A naive `field=value` suffix breaks because the image URL itself contains a literal `=` (`?wid=1000`), and there's more than one field. Instead, the remainder after `edit:<imageId>:` becomes a JSON-encoded edits object when a value is already known:

```
edit:<imageId>:<encodeURIComponent(JSON.stringify({ productImage, oldPrice, price }))>
```

`parseEditOptionId` is extended: after splitting off `imageId`, try `JSON.parse(decodeURIComponent(remainder))`. If it parses to a plain object, treat this as a **fully-specified edit** (`{ imageId, edits }`). If parsing throws, fall back to the existing behavior — remainder is a bare field name (`{ imageId, fieldName }`).

`messageTextForInteractiveReply` is extended to match:
- Fully-specified (`edits` present): build a synthetic user message listing every field/value, e.g. `I'd like to change "productImage" to "https://...", "oldPrice" to "33999", "price" to "27199" on image img_1.` GPT already has a system-prompt rule that a fully-specified request should go straight to `edit_graphic` — no new prompt change needed here.
- Bare field (existing case): unchanged — asks GPT to prompt for the missing value.

This keeps one general mechanism for "a button tap that already knows its value(s)" rather than adding TV-specific parsing.

## Validation / error handling

Unchanged and reused: when `edit_graphic` runs, `actionEditGraphic` already checks every requested key against the real tagged document's element names and rejects unknown ones with the existing friendly message. If `productImage`/`oldPrice`/`price` aren't real tags on a given document, the user gets that existing rejection message — no new error handling to write.

## Testing

- Unit test for the extended `parseEditOptionId`/`messageTextForInteractiveReply`: bare-field id still parses as before; a JSON-encoded multi-field id parses to `{ imageId, edits }` and produces a message listing all fields/values.
- Unit test for `actionSelectTvModel`: returns 3 options, each titled with a model name, each `id` decodable back to `{ productImage, oldPrice, price }` with the expected values.
- Manual/simulated webhook check: "change product to tv" → 3 buttons in one message → tap one → `edit_graphic` called with all 3 fields → thumbnail sent.

## Out of scope

- Per-model images or pricing (all 3 buttons currently share the same values).
- Any product category other than TV.
- A data-driven/config-file catalog of product categories — revisit if a second category is actually needed.
