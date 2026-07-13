const test = require('node:test');
const assert = require('node:assert/strict');
const { getTemplateInfo, applyEdit } = require('./expressApi');

test('getTemplateInfo returns the unlocked layers for a known template', () => {
  const info = getTemplateInfo('tpl_diwali');
  assert.deepEqual(info, {
    templateId: 'tpl_diwali',
    unlockedLayers: ['discount_text', 'headline', 'background_color'],
  });
});

test('getTemplateInfo returns the unlocked layers for the Croma earbuds template', () => {
  const info = getTemplateInfo('tpl_croma_earbuds');
  assert.deepEqual(info, {
    templateId: 'tpl_croma_earbuds',
    unlockedLayers: ['Price', 'Address', 'Product Image', 'Partner Logo'],
  });
});

test('getTemplateInfo returns an empty layer list for an unknown template', () => {
  const info = getTemplateInfo('tpl_does_not_exist');
  assert.deepEqual(info.unlockedLayers, []);
});

test('applyEdit merges new edits on top of current edits', () => {
  const result = applyEdit('tpl_diwali', { headline: 'Old Headline' }, { discount_text: '70%' });
  assert.deepEqual(result.mergedEdits, { headline: 'Old Headline', discount_text: '70%' });
});

test('applyEdit returns a rendered image url that references the template', () => {
  const result = applyEdit('tpl_summer', {}, { headline: 'Flash Sale' });
  assert.match(result.renderedImageUrl, /^https:\/\/mock-express\.local\/render\/tpl_summer\?rev=\d+$/);
});

test('applyEdit returns the fixed updated Croma earbuds image for any edit', () => {
  const result = applyEdit('tpl_croma_earbuds', {}, { Price: '999' });
  assert.equal(result.renderedImageUrl, 'https://s7ap1.scene7.com/is/image/varun/croma1-earbuds-updated');
});
