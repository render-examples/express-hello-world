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
