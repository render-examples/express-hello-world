# Design: Global fixed responses for edit-graphic and check-allowed-edits

Amends [2026-07-13-express-edit-flow-design.md](./2026-07-13-express-edit-flow-design.md).

## Goal

Simplify two of the existing edit-flow actions in `actions.js` so their outputs are fixed, regardless of which image/template the request is about:

1. **`edit_graphic`** — after any successful edit, always send the same hardcoded image (`https://s7ap1.scene7.com/is/image/varun/croma1-earbuds-updated`) as a new WhatsApp image message to the requesting user. No more per-template mock render or Meta upload.
2. **`check_allowed_edits`** — always reply with the fixed text `Price, Partner logo, Partner's Address, product image`, regardless of which image is asked about.

As a consequence, the "is this edit key allowed for this template" validation in `actionEditGraphic` is removed: any edit key is now accepted for any image.

## Scope

Only `actions.js` changes. `expressApi.js`, `imageStore.js`, `metaUpload.js`, and `app.js` are untouched — `expressApi.js` and `metaUpload.js` become unused by application code (no longer called from `actions.js`) but are left in place, along with their existing tests, as placeholders for a future real Adobe Express / Meta upload integration.

## Changes to `actions.js`

Two new constants:

```js
const EDITED_IMAGE_URL = 'https://s7ap1.scene7.com/is/image/varun/croma1-earbuds-updated';
const ALLOWED_EDITS_TEXT = "Price, Partner logo, Partner's Address, product image";
```

`actionCheckAllowedEdits(phoneNumber, imageId)`:
- Keeps the unknown-image guard (`formatUnknownImageMessage`).
- For any known image, returns `ALLOWED_EDITS_TEXT` unconditionally — no more per-template `getTemplateInfo` lookup.

`actionEditGraphic(phoneNumber, imageId, edits, { sendImage })`:
- Keeps the unknown-image guard.
- Drops the disallowed-key validation entirely (no `getTemplateInfo` call, no rejection path).
- Merges `edits` into `image.currentEdits` directly (`{ ...image.currentEdits, ...edits }`) instead of calling `expressApi.applyEdit` — the rendered URL it used to return is no longer needed since we always send `EDITED_IMAGE_URL`.
- Sends `EDITED_IMAGE_URL` via `sendImage` (no more `metaUpload.uploadImageToMeta` call, since this URL is already publicly hosted).
- Returns the same `Updated "<name>":\n<summary>` confirmation text as before.

Unused imports (`getTemplateInfo`, `applyEdit` from `expressApi.js`; `uploadImageToMeta` from `metaUpload.js`) are removed from `actions.js`.

## Error handling

Unchanged from the existing flow: an unknown `image_id` (GPT hallucination) still gets the friendly "I couldn't find that image" message in both actions, with no crash. There is no other error path left in `actionEditGraphic` now that key validation is removed.

## Testing

Update `actions.test.js`:
- `actionCheckAllowedEdits` tests for known images (Diwali, Croma) now assert the reply equals `ALLOWED_EDITS_TEXT`, for any tracked image — not a per-template layer list.
- The "rejects edits outside the unlocked layers" test is replaced with a test confirming a previously-disallowed key (e.g. `background_color` on the Croma image) is now accepted and sends the image.
- The edit tests (Croma image, Summer Sale Flyer image) both assert `sendImage` is called with `EDITED_IMAGE_URL`, for every template — not just Croma.
- The "remembers the edit" assertion (`image.currentEdits`) is unchanged.

`expressApi.test.js` and `metaUpload.test.js` are untouched — those modules' own behavior isn't changing, only their (lack of) callers.
