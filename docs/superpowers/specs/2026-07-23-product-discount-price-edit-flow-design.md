# Design: Fixed Edit Product/Discount/Price menu with Hinglish-mirrored replies

## Goal

Support this WhatsApp conversation flow for Express-catalog graphics (e.g. the Croma/TV template):

1. User sends an edit message ("I want to edit this" / similar).
2. Bot shows "What would you like to change?" with 3 quick-reply buttons: **Edit Product**, **Edit Discount**, **Edit Price**.
3. User taps **Edit Product**.
4. Bot shows a WhatsApp **list** message: "Which product do you want?" with a "Choose product" button and the 3 TV models as rows.
5. User picks a model (e.g. Sony Bravia K-75).
6. Bot calls the Express API to set `productImage`, `oldPrice` (33999), `price` (27199) in one shot.
7. Bot sends the updated image, a phrased confirmation ("I have updated product, with price & discount"), and the 3-button menu again.
8. User asks for a discount in Hinglish ("discount ko 50% kar do").
9. Bot computes the implied price, finds it exceeds the 40% cap, denies in Hinglish ("Iss product pr maximum 40% discount de sakte hain"), and shows the 3-button menu again.
10. User accepts the cap ("Theek h, 40% hi kar do").
11. Bot computes price = 33999 × 0.6 = 20399, applies it, sends the updated image, a phrased Hinglish confirmation ("Maine discount aur price updated kar diya hai"), and the 3-button menu again.

Scope: this replaces `check_allowed_edits`'s behavior **only for `source: 'express'` graphics** (the Express-catalog templates, e.g. the TV/Croma one). Local/Onam-style `source: 'local'` designs (background/address/headline edits — no product or price concept) are untouched and keep today's dynamic field-list menu. Editable field names on the real document are expected to be `productImage`, `oldPrice`, `price` as used today, though exact tag names may vary slightly later — see "Field name matching" below.

## 1. Fixed top-level menu (reuses existing bare-field id scheme)

`actionCheckAllowedEdits` branches on `image.source`:
- `'local'` → unchanged (today's dynamic field list from `localEditElements`).
- `'express'` → always returns 3 fixed options, using the existing bare-field id scheme from `interactiveReply.js` (`edit:<imageId>:<fieldName>`, **no changes needed to that module**):

```js
const TOP_LEVEL_EDIT_FIELDS = [
  { fieldName: 'product', title: 'Edit Product' },
  { fieldName: 'discount', title: 'Edit Discount' },
  { fieldName: 'price', title: 'Edit Price' },
];
```

`bodyText`: `"What would you like to change?"` (fixed, English, never phrased by GPT — button/menu copy stays constant regardless of conversation language).

Tapping a button produces the same kind of synthetic message as today, e.g. `"I'd like to change \"discount\" on image img_1."`, fed back through `decideAction`.

### New system-prompt rules for these three bare fields

- `"product"` → call `select_tv_model` (same tool used today for free-text "change product to tv"; only TV category exists, so no ambiguity).
- `"discount"` with no value yet, or `"price"` with no value yet → `ask_for_more_information` (existing bare-field behavior, unchanged).
- `"discount"` **with a value** (e.g. "50%", "50 percent", "discount ko 50% kar do") → GPT computes `newPrice = round(oldPrice × (1 − discountPercent/100))` using the `oldPrice` shown in the images list (see below), then calls `edit_graphic` with `{ price: newPrice }` only (never touches `oldPrice`).
- `"price"` **with a value** → call `edit_graphic` with `{ price: <value> }` directly, no computation.

## 2. Images list gains current field values

`decideAction`'s system prompt `imagesList` is extended from `- <id>: <name>` to include known current values pulled from `image.currentEdits` (already tracked in `imageStore`, no new storage):

```
- img_1: Croma Diwali offer (oldPrice: 33999, price: 27199)
```

This is what lets GPT compute a discount-derived price without an extra round trip to ask the user "what's the current price?".

## 3. Product picker becomes a real WhatsApp list message

`actionSelectTvModel` gains a `buttonText` field:

```js
function actionSelectTvModel(imageId) {
  return {
    type: 'edit_options',
    bodyText: 'Which product do you want?',
    buttonText: 'Choose product',
    options: TV_MODEL_TITLES.map((title) => ({ id: buildValueEditId(imageId, TV_MODEL_EDITS), title })),
  };
}
```

New `sendList(to, { bodyText, buttonText, options })` in `app.js` builds a native list message:

```js
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
        sections: [{ rows: options.map((o) => ({ id: o.id, title: o.title })) }],
      },
    },
  });
}
```

`sendEditOptions` picks list-vs-buttons based on whether `buttonText` is present on the result:

```js
async function sendEditOptions(to, result) {
  if (result.options.length === 0) return sendText(to, result.bodyText);
  if (result.buttonText) return sendList(to, result);
  // ...existing button-chunking loop, unchanged
}
```

The fixed 3-button top-level menu (part 1) has no `buttonText`, so it keeps using buttons as today — only the product picker becomes a list. Model titles stay as they are today: Sony Bravia K-75 / LG UA82 AI / Samsung UA4. LG and Samsung continue to share Sony's placeholder image/price (existing, intentional scoping from the prior TV-swap design — not changed here).

Row `id`s reuse `buildValueEditId` exactly as today, so tapping a list row parses identically to tapping a button (`message?.interactive?.list_reply` is already read defensively in `app.js`).

## 4. Generalized 40% discount cap (server-enforced, not GPT-trusted)

Today's cap (`MAX_DISCOUNT_PERCENT = 40`, `editExpressDesign`) only fires on a literal field matching `/discount/i`. Since GPT now computes and submits a plain `price`, this needs to generalize: whenever the edits (merged with `image.currentEdits`) contain both an "old price" field and a "new price" field, compute the implied discount and reject if it exceeds the cap — regardless of whether the user phrased it as a discount % or a direct price.

### Field name matching

To tolerate minor future naming variation (per your note), matching is regex-based rather than exact-string:
- Reference/original price: `/^old.?price$/i` (matches `oldPrice`, `old_price`).
- New/selling price: `/(^|_)price$/i`, excluding whatever matched as the reference price above.

```js
function findOldPriceKey(keys) {
  return keys.find((k) => /^old.?price$/i.test(k));
}
function findNewPriceKey(keys, oldPriceKey) {
  return keys.find((k) => k !== oldPriceKey && /(^|_)price$/i.test(k));
}
```

In `editExpressDesign`, after merging `edits` into `image.currentEdits`:

```js
const mergedEdits = { ...image.currentEdits, ...edits };
const oldPriceKey = findOldPriceKey(Object.keys(mergedEdits));
const newPriceKey = findNewPriceKey(Object.keys(mergedEdits), oldPriceKey);
if (oldPriceKey && newPriceKey && requestedKeys.includes(newPriceKey)) {
  const oldPrice = Number(mergedEdits[oldPriceKey]);
  const newPrice = Number(mergedEdits[newPriceKey]);
  const impliedDiscountPercent = ((oldPrice - newPrice) / oldPrice) * 100;
  const ROUNDING_TOLERANCE_PERCENT = 0.5;
  if (impliedDiscountPercent > MAX_DISCOUNT_PERCENT + ROUNDING_TOLERANCE_PERCENT) {
    return { status: 'discount_capped', productName: image.name, maxPercent: MAX_DISCOUNT_PERCENT };
  }
}
```

This replaces the existing `oversizedDiscountKeys` literal-field check (kept as a fallback for any future literal `discount_text`-style field, unchanged logic there).

Boundary case: exactly 40% is allowed. Note that rounding the computed price to a whole number introduces sub-percent noise — e.g. 33999 × 0.6 = 20399.4, and whichever way GPT rounds that (20399 or 20400), the *implied* discount off the resulting whole-rupee price is 40.0012% or 39.9988%, never exactly 40.0000%. The cap check therefore compares against `MAX_DISCOUNT_PERCENT + 0.5` (a half-point rounding tolerance), not a strict `> 40`, so whole-rupee rounding on either side of the requested percentage never flips a legitimate at-cap request into a rejection. A genuinely excessive ask (e.g. 50%) is far outside this tolerance and still rejected.

## 5. Structured outcomes + dynamic, language-mirrored replies

`actionEditGraphic` (Express path) and `actionSelectTvModel`'s eventual `edit_graphic` call no longer return final hardcoded strings. They return a structured outcome:

```js
{ status: 'success', productName, changes: { productImage, oldPrice, price, ... } }
{ status: 'discount_capped', productName, maxPercent: 40 }
{ status: 'disallowed_fields', productName, disallowedKeys, allowedSummary }
{ status: 'error', productName, reason }
```

New `phraseOutcome(phoneNumber, userMessage, outcome)` in `app.js`: a second, tool-free OpenAI chat completion call that turns the structured outcome into the actual WhatsApp reply text, matching the user's language style:

> System prompt: "You are a WhatsApp assistant. Given this outcome, write a short reply to the user. Match the user's language and style — if their message was Hinglish (romanized Hindi mixed with English), reply in Hinglish; otherwise reply in English. Don't invent facts beyond the outcome given.
>
> Examples of the tone/style to match:
> - Success (English): 'I have updated product, with price & discount'
> - Success (Hinglish): 'Maine discount aur price updated kar diya hai'
> - Capped (Hinglish): 'Iss product pr maximum 40% discount de sakte hain'"
>
> User message: `<last user message>`
> Outcome: `<JSON.stringify(outcome)>`

Its `content` becomes the `sendText` reply. This applies **only** to `edit_graphic`/`select_tv_model` outcomes on Express-catalog graphics — menu prompts and button/row titles stay fixed English strings always (never phrased by GPT), matching the script where the 3-button menu reappears in English even mid-Hinglish conversation.

`phraseOutcome` isn't unit-tested for exact wording (it's an LLM call); the *outcome data* feeding into it is fully unit-tested instead. Manual/simulated webhook checks verify the reply is sensible and in the right language register.

## 6. Post-edit menu resurfacing

For Express-catalog graphics, every `edit_graphic`/`select_tv_model` outcome — success or capped/rejected — is followed by resending the fixed 3-button menu. Dispatch sequence in `app.js` for these actions:

1. Run the action → get structured outcome.
2. If `status === 'success'`, `sendImage` the updated thumbnail.
3. `phraseOutcome(...)` → `sendText` the phrased reply.
4. `sendButtons(phoneNumber, 'What would you like to change?', TOP_LEVEL_EDIT_OPTIONS)` — always, regardless of outcome, for Express-catalog graphics only.

Local/Onam designs keep their current single-reply behavior (no forced menu resend) — this step only fires when `image.source === 'express'`.

## Testing

- Unit tests for `findOldPriceKey`/`findNewPriceKey` and the generalized cap check: under cap, exactly at cap (40%, passes), over cap (rejected), missing old/new price keys (no-op, falls through to existing behavior).
- Unit tests for `sendList` payload shape (list type, button text, row ids/titles).
- Unit tests for `actionCheckAllowedEdits` on `source: 'express'` images returning the 3 fixed bare-field options; `source: 'local'` images unaffected.
- Unit tests for `actionSelectTvModel` including the new `buttonText` field.
- Existing `interactiveReply.test.js` coverage is unchanged (no new id scheme introduced).
- Manual/simulated webhook run through the full script: edit → product list → pick Sony → confirmation + menu → Hinglish discount request → capped denial + menu → accept 40% → success + menu.

## Out of scope

- Per-model distinct images/pricing for LG/Samsung (still shared placeholder, per existing TV-swap design).
- Any product category other than TV.
- Exact-wording assertions on GPT-phrased replies.
- Changes to `list_campaign_graphics`, `create_design`, or `generate_bulk_graphics` — untouched.
