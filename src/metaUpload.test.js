const test = require('node:test');
const assert = require('node:assert/strict');
const { uploadImageToMeta } = require('./metaUpload');

test('uploadImageToMeta returns a mock CDN url', async () => {
  const url = await uploadImageToMeta('https://mock-express.local/render/tpl_diwali?rev=1');
  assert.match(url, /^https:\/\/mock-meta-cdn\.local\/media\/[0-9a-f-]+\.png$/);
});

test('uploadImageToMeta returns a different url on each call', async () => {
  const first = await uploadImageToMeta('https://mock-express.local/render/tpl_diwali?rev=1');
  const second = await uploadImageToMeta('https://mock-express.local/render/tpl_diwali?rev=2');
  assert.notEqual(first, second);
});

test('uploadImageToMeta passes through urls that are already publicly hosted', async () => {
  const url = await uploadImageToMeta('https://s7ap1.scene7.com/is/image/varun/croma1-earbuds-updated');
  assert.equal(url, 'https://s7ap1.scene7.com/is/image/varun/croma1-earbuds-updated');
});
