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

test('getTrackedImages returns an empty list when the catalog is not an array', () => {
  writeFixtureCatalog({});

  const images = getTrackedImages('phone-2-non-array');

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
