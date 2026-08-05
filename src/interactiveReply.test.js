const test = require('node:test');
const assert = require('node:assert/strict');
const { buildValueEditId, parseEditOptionId, messageTextForInteractiveReply } = require('./interactiveReply');

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
