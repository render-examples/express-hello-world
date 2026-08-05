# Design: Image edit flow (Adobe Express, mocked)

## Goal

Support this WhatsApp conversation flow:

1. User has previously been sent a message containing an image (graphic).
2. User asks what edits are allowed on one of those images.
3. System looks up which template the image used and which layers are unlocked (via Adobe Express API).
4. User asks for a specific edit.
5. System checks whether the requested edit is one of the allowed edits.
6. System calls the Adobe Express API to apply the edit.
7. System uploads the resulting image to Meta and gets back a URL.
8. System sends a new WhatsApp message with the updated image.

Adobe Express API calls are out of scope for this iteration — all Express/Meta-upload calls are placeholder functions returning mock values, structured so they can be swapped for real implementations later without changing the surrounding flow.

Actually sending the *initial* graphic image (step 1) is out of scope. Instead, a small set of mock "sent images" is pre-seeded at server startup for any phone number, so the rest of the flow has something to operate against.

## Data model

New in-memory store, `imageStore.js`, following the same per-phone-number Map pattern as the existing `conversationHistory`:

```js
// Map<phoneNumber, Array<TrackedImage>>
// Seeded lazily on first access for a phone number — same 3 mock entries every time.
{
  id: 'img_1',                    // stable id GPT references in tool calls
  name: 'Diwali Offer Banner',    // human-readable, shown to GPT so it can match user text
  templateId: 'tpl_diwali',       // Express template id
  currentEdits: {},               // accumulates applied edits across calls
}
```

Three seed entries (mirroring the existing `list_campaign_graphics` mock names): Diwali Offer Banner / Summer Sale Flyer / New Arrival Poster, each with a distinct mock `templateId`.

`getTrackedImages(phoneNumber)` returns (seeding if needed) the array; `findTrackedImage(phoneNumber, imageId)` returns one entry or `undefined`.

## GPT tool changes

GPT is responsible for figuring out *which* tracked image a user's message refers to (per your choice of "GPT infers from text"), so the system prompt must include the phone number's tracked images (id + name) on every call to `decideAction`. Both relevant tools gain an `image_id` parameter:

```js
check_allowed_edits({ image_id })
edit_graphic({ image_id, edits })
```

`image_id` is required on both. Tool descriptions instruct GPT to pick the id from the list provided in the system prompt, matching the user's description (e.g. "the Diwali one") to the closest tracked image name.

System prompt gains a section like:

```
Images previously sent to this user (reference by id):
- img_1: Diwali Offer Banner
- img_2: Summer Sale Flyer
- img_3: New Arrival Poster
```

## Mock Adobe Express API (`expressApi.js`)

Placeholder module, no network calls:

```js
function getTemplateInfo(templateId) {
  // Mock: returns different unlocked layers per template so behavior isn't uniform.
  // e.g. tpl_diwali -> ['discount_text', 'headline', 'background_color']
  //      tpl_summer -> ['headline', 'font_color']
  //      tpl_newarrival -> ['headline']
}

function applyEdit(templateId, currentEdits, newEdits) {
  // Mock: merges edits, returns a fake rendered-image reference
  // e.g. { renderedImageUrl: 'https://mock-express.local/render/tpl_diwali?rev=3' }
}
```

Both are synchronous or trivially async (`Promise.resolve`) mocks — no real HTTP calls yet.

## Mock Meta upload

Added alongside the existing WhatsApp helpers in app.js (or a small `whatsapp.js` if we split further — not required for this scope):

```js
async function uploadImageToMeta(renderedImageUrl) {
  // Mock: pretend to upload to Meta's media endpoint, return a fake CDN url
  // e.g. `https://mock-meta-cdn.local/media/<uuid>.png`
}
```

`sendImage(to, link)` already exists and takes a link — the mock URL from `uploadImageToMeta` is passed straight into it.

## Action handlers

### `actionCheckAllowedEdits(phoneNumber, imageId)`

1. `findTrackedImage(phoneNumber, imageId)` — if not found, return an error message ("I couldn't find that image — here's what I have: ...").
2. `getTemplateInfo(image.templateId)` → `unlockedLayers`.
3. Return a formatted list of allowed edits for that specific image (not the generic hardcoded string currently returned).

### `actionEditGraphic(phoneNumber, imageId, edits)`

1. `findTrackedImage(phoneNumber, imageId)` — same not-found handling as above.
2. `getTemplateInfo(image.templateId)` → `unlockedLayers`.
3. Validate: every key in `edits` must be in `unlockedLayers`. If any key isn't allowed, return a message naming the rejected field(s) and listing the actually-allowed fields — **do not call Express or Meta**. This is the "system checks if this is one of the allowed edits" step, done in code, not by GPT.
4. `applyEdit(templateId, image.currentEdits, edits)` → mock render; merge `edits` into `image.currentEdits`.
5. `uploadImageToMeta(renderedImageUrl)` → mock URL.
6. `sendImage(phoneNumber, mockUrl)` — new WhatsApp message with the updated image.
7. Return a short confirming text (e.g. "Updated: discount_text → 70%") which is sent as a follow-up text message via the existing `sendText` call in the webhook handler.

## Webhook wiring

In `app.post('/')`, the `check_allowed_edits` and `edit_graphic` cases pass `args.image_id` (and `args.edits`) through to the updated action handlers. No change to the outer loop structure.

## Error handling

- Unknown `image_id` (GPT hallucination): friendly text response listing currently tracked images, no crash.
- Disallowed edit field(s): friendly text response naming what's not allowed and what is, no Express/Meta calls made.
- Mock functions never throw — real error handling (network failures, Express API errors) is deferred to when real API calls replace the mocks.

## Testing

Manual verification only for this mocked iteration (no live Express/Meta credentials exist yet):
- Simulate incoming webhook payloads for: "what edits can I make to the summer flyer", followed by "change the headline to Flash Sale" — confirm the reply lists the right mock unlocked layers and then confirms the edit + attempts a mock image send.
- Simulate an edit request for a field not in `unlockedLayers` — confirm it's rejected with the allowed-fields message and no image is sent.
- Simulate a reference to a nonexistent image — confirm the not-found message.

## Out of scope

- Real Adobe Express API integration.
- Real Meta media upload.
- Actually sending the initial graphic image that seeds the flow (images are pre-seeded in memory instead).
- Persistence across server restarts (in-memory only, matches existing `conversationHistory` pattern).
