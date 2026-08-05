const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { actionCheckAllowedEdits, actionEditGraphic } = require('./actions');
const expressApi = require('./express/expressApi');
const { findTrackedImage, recordEdits } = require('./imageStore');

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

test('actionCheckAllowedEdits shows the latest edited value instead of the stale original document value', async () => {
  writeFixtureCatalog([{ id: 'img_1', name: 'Croma Earbuds', docId: 'urn:doc:1' }]);
  expressApi.getTaggedDocument = async () => SAMPLE_ELEMENTS_DOC;
  recordEdits('phone-1b', 'img_1', { cta: '20% off' });

  const reply = await actionCheckAllowedEdits('phone-1b', 'img_1');

  assert.match(reply, /cta: currently "20% off"/);
  assert.doesNotMatch(reply, /Available at our store starting 15 Aug 20XX\./);
  assert.match(reply, /heading: currently "The X-Phone Pro is here!"/);
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
  expressApi.pollJobStatus = async (statusUrl) => {
    assert.equal(statusUrl, 'https://express-api.adobe.io/status/job-1');
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

test('actionEditGraphic tells the user delivery failed but keeps the recorded edit when sendImage throws', async () => {
  writeFixtureCatalog([{ id: 'img_1', name: 'Croma Earbuds', docId: 'urn:doc:1' }]);
  expressApi.getTaggedDocument = async () => SAMPLE_ELEMENTS_DOC;
  expressApi.generateVariation = async () => ({ jobId: 'job-1', statusUrl: 'https://express-api.adobe.io/status/job-1' });
  expressApi.pollJobStatus = async () => ({ status: 'succeeded', document: { thumbnailUrl: 'https://example.com/thumb.png' } });

  const sendImage = async () => { throw new Error('WhatsApp could not fetch the link'); };

  const reply = await actionEditGraphic('phone-7', 'img_1', { cta: '20% off' }, { sendImage });

  assert.match(reply, /couldn't send the image right now/);
  assert.doesNotMatch(reply, /something went wrong generating/);

  const image = findTrackedImage('phone-7', 'img_1');
  assert.deepEqual(image.currentEdits, { cta: '20% off' });
});
