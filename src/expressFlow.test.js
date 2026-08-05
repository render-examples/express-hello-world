const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const expressFlow = require('./expressFlow');
const expressApi = require('./express/expressApi');
const s3Upload = require('./express/s3Upload');
const { findTrackedImage, recordEdits } = require('./imageStore');
const { parseEditOptionId } = require('./interactiveReply');

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

const TV_ELEMENTS_DOC = {
  documentPages: [
    {
      pageNumber: 1,
      taggedElements: [
        { name: 'productImage', type: 'image', value: '' },
        { name: 'oldPrice', type: 'text', value: '' },
        { name: 'price', type: 'text', value: '' },
      ],
    },
  ],
};

// A catalog (source: 'express') image resolved through imageStore.
function catalogImage(phone) {
  writeFixtureCatalog([{ id: 'img_1', name: 'Croma Earbuds', docId: 'urn:doc:1' }]);
  return findTrackedImage(phone, 'img_1');
}

test('checkAllowedEdits returns the fixed Edit Product/Discount/Price menu, without calling the Express API', async () => {
  expressApi.getTaggedDocument = async () => { throw new Error('should not be called'); };
  const image = catalogImage('phone-1');

  const reply = await expressFlow.checkAllowedEdits(image);

  assert.equal(reply.type, 'edit_options');
  assert.equal(reply.bodyText, 'What would you like to change?');
  assert.deepEqual(reply.options, [
    { id: 'edit:img_1:product', title: '🛍️ Edit Product' },
    { id: 'edit:img_1:discount', title: '🏷️ Edit Discount' },
    { id: 'edit:img_1:price', title: '💰 Edit Price' },
  ]);
  assert.match(reply.historyText, /Edit Product/);
});

test('buildTopLevelEditOptions ids parse back to the "product"/"discount"/"price" bare fields', () => {
  const { options } = expressFlow.buildTopLevelEditOptions('img_1');

  assert.deepEqual(
    options.map((option) => parseEditOptionId(option.id)),
    [
      { imageId: 'img_1', fieldName: 'product' },
      { imageId: 'img_1', fieldName: 'discount' },
      { imageId: 'img_1', fieldName: 'price' },
    ]
  );
});

test('editGraphic returns a disallowed_fields status and makes no generate call for a field outside the tagged elements', async () => {
  expressApi.getTaggedDocument = async () => SAMPLE_ELEMENTS_DOC;
  expressApi.generateVariation = async () => {
    throw new Error('should not be called');
  };
  const image = catalogImage('phone-4');

  const result = await expressFlow.editGraphic('phone-4', image, { background_color: 'red' }, {});

  assert.equal(result.status, 'disallowed_fields');
  assert.equal(result.productName, 'Croma Earbuds');
  assert.deepEqual(result.disallowedKeys, ['background_color']);
  assert.match(result.allowedSummary, /Edits allowed on "Croma Earbuds"/);
});

test('editGraphic applies an allowed edit end-to-end: generates, polls, and returns a success outcome with the thumbnail', async () => {
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
  const image = catalogImage('phone-5');

  const result = await expressFlow.editGraphic('phone-5', image, { cta: '20% off' }, {});

  assert.deepEqual(result, {
    status: 'success',
    productName: 'Croma Earbuds',
    changes: { cta: '20% off' },
    thumbnailUrl: 'https://example.com/thumb.png',
  });

  const updated = findTrackedImage('phone-5', 'img_1');
  assert.deepEqual(updated.currentEdits, { cta: '20% off' });
});

test('editGraphic serves a product-change request from the hardcoded banner and makes no Express/S3 calls', async () => {
  s3Upload.uploadFromUrl = async () => { throw new Error('should not be called'); };
  expressApi.getTaggedDocument = async () => { throw new Error('should not be called'); };
  expressApi.generateVariation = async () => { throw new Error('should not be called'); };
  const image = catalogImage('phone-tv');
  const sentTexts = [];

  const edits = { productImage: expressFlow.TV_PLACEHOLDER_IMAGE_TOKEN, oldPrice: '33999', price: '27199' };
  const result = await expressFlow.editGraphic('phone-tv', image, edits, {
    sendText: async (phone, text) => sentTexts.push([phone, text]),
  });

  assert.deepEqual(result, {
    status: 'success',
    productName: 'Croma Earbuds',
    changes: edits,
    thumbnailUrl: expressFlow.HARDCODED_PRODUCT_UPDATE_THUMBNAIL_URL,
    price: '27199',
    oldPrice: '33999',
  });
  assert.deepEqual(sentTexts, [['phone-tv', '⏳ Applying your edit and re-rendering with Adobe Express…']]);

  const updated = findTrackedImage('phone-tv', 'img_1');
  assert.equal(updated.currentEdits.productImage, expressFlow.TV_PLACEHOLDER_IMAGE_TOKEN);
});

test('editGraphic serves a discount-change request from the hardcoded banner and makes no Express calls, stripping discountPercentage before recording', async () => {
  expressApi.getTaggedDocument = async () => { throw new Error('should not be called'); };
  expressApi.generateVariation = async () => { throw new Error('should not be called'); };
  const image = catalogImage('phone-discount');
  const sentTexts = [];

  const edits = { price: 20399, discountPercentage: '40%' };
  const result = await expressFlow.editGraphic('phone-discount', image, edits, {
    sendText: async (phone, text) => sentTexts.push([phone, text]),
  });

  assert.deepEqual(result, {
    status: 'success',
    productName: 'Croma Earbuds',
    changes: { price: 20399 },
    thumbnailUrl: expressFlow.HARDCODED_DISCOUNT_UPDATE_THUMBNAIL_URL,
    price: 20399,
  });
  assert.deepEqual(sentTexts, [['phone-discount', '⏳ Applying your edit and re-rendering with Adobe Express…']]);

  const updated = findTrackedImage('phone-discount', 'img_1');
  assert.deepEqual(updated.currentEdits, { price: 20399 });
  assert.ok(!('discountPercentage' in updated.currentEdits));
});

test('editGraphic caps a discount-change request above 40% without calling Express', async () => {
  expressApi.getTaggedDocument = async () => { throw new Error('should not be called'); };
  expressApi.generateVariation = async () => { throw new Error('should not be called'); };
  const image = catalogImage('phone-discount-2');

  const result = await expressFlow.editGraphic(
    'phone-discount-2',
    image,
    { price: 16999, discountPercentage: '50%' },
    {}
  );

  assert.deepEqual(result, { status: 'discount_capped', productName: 'Croma Earbuds', maxPercent: 40 });

  const updated = findTrackedImage('phone-discount-2', 'img_1');
  assert.deepEqual(updated.currentEdits, {});
});

test('editGraphic returns an api_error/generate_failed status and does not record the edit when generation fails', async () => {
  expressApi.getTaggedDocument = async () => SAMPLE_ELEMENTS_DOC;
  expressApi.generateVariation = async () => { throw new Error('generateVariation failed 500: boom'); };
  const image = catalogImage('phone-6');

  const result = await expressFlow.editGraphic('phone-6', image, { cta: '20% off' }, {});

  assert.equal(result.status, 'api_error');
  assert.equal(result.reason, 'generate_failed');

  const updated = findTrackedImage('phone-6', 'img_1');
  assert.deepEqual(updated.currentEdits, {});
});

test('editGraphic returns an api_error/lookup_failed status when getTaggedDocument fails', async () => {
  expressApi.getTaggedDocument = async () => { throw new Error('getTaggedDocument failed 500: boom'); };
  const image = catalogImage('phone-8');

  const result = await expressFlow.editGraphic('phone-8', image, { cta: '20% off' }, {});

  assert.equal(result.status, 'api_error');
  assert.equal(result.reason, 'lookup_failed');
});

test('editGraphic rejects a price edit implying more than 40% off and makes no generate call', async () => {
  writeFixtureCatalog([{ id: 'img_2', name: 'TV Product', docId: 'urn:doc:2' }]);
  expressApi.getTaggedDocument = async () => TV_ELEMENTS_DOC;
  expressApi.generateVariation = async () => { throw new Error('should not be called'); };
  recordEdits('phone-9', 'img_2', { productImage: 'https://example.com/tv.png', oldPrice: 33999, price: 27199 });
  const image = findTrackedImage('phone-9', 'img_2');

  const result = await expressFlow.editGraphic('phone-9', image, { price: 17000 }, {});

  assert.equal(result.status, 'discount_capped');
  assert.equal(result.maxPercent, 40);
});

test('editGraphic applies a price edit at exactly the 40% cap (within rounding tolerance)', async () => {
  writeFixtureCatalog([{ id: 'img_2', name: 'TV Product', docId: 'urn:doc:2' }]);
  expressApi.getTaggedDocument = async () => TV_ELEMENTS_DOC;
  expressApi.generateVariation = async (docId, tagMappings) => {
    assert.deepEqual(tagMappings, { productImage: 'https://example.com/tv.png', oldPrice: '33999', price: '20399' });
    return { jobId: 'job-2', statusUrl: 'https://express-api.adobe.io/status/job-2' };
  };
  expressApi.pollJobStatus = async () => ({ status: 'succeeded', document: { thumbnailUrl: 'https://example.com/thumb2.png' } });
  recordEdits('phone-10', 'img_2', { productImage: 'https://example.com/tv.png', oldPrice: 33999, price: 27199 });
  const image = findTrackedImage('phone-10', 'img_2');

  const result = await expressFlow.editGraphic('phone-10', image, { price: 20399 }, {});

  assert.equal(result.status, 'success');
  assert.deepEqual(result.changes, { price: 20399 });
});

test('editGraphic stringifies numeric edit values before calling generate-variation (Adobe rejects a JSON number for a text tag with "Unsupported text value")', async () => {
  writeFixtureCatalog([{ id: 'img_3', name: 'TV Product', docId: 'urn:doc:3' }]);
  expressApi.getTaggedDocument = async () => TV_ELEMENTS_DOC;
  expressApi.generateVariation = async (docId, tagMappings) => {
    assert.deepEqual(tagMappings, { productImage: 'https://example.com/tv.png', oldPrice: '33999', price: '30000' });
    for (const value of Object.values(tagMappings)) assert.equal(typeof value, 'string');
    return { jobId: 'job-3', statusUrl: 'https://express-api.adobe.io/status/job-3' };
  };
  expressApi.pollJobStatus = async () => ({ status: 'succeeded', document: { thumbnailUrl: 'https://example.com/thumb3.png' } });
  recordEdits('phone-11', 'img_3', { productImage: 'https://example.com/tv.png', oldPrice: 33999, price: 27199 });
  const image = findTrackedImage('phone-11', 'img_3');

  const result = await expressFlow.editGraphic('phone-11', image, { price: 30000 }, {});

  assert.equal(result.status, 'success');
  assert.equal(result.price, 30000); // outcome keeps the numeric value for caption formatting
});

test('selectTvModel returns the 3 fixed TV model options with a list-picker body text and button', () => {
  const result = expressFlow.selectTvModel('img_1');

  assert.equal(result.type, 'edit_options');
  assert.equal(result.bodyText, 'Which product do you want?');
  assert.equal(result.buttonText, 'Choose product');
  assert.equal(result.options.length, 3);
  assert.deepEqual(
    result.options.map((option) => option.title),
    ['Sony Bravia K-75', 'LG UA82 AI', 'Samsung UA4']
  );
});

test('selectTvModel gives every option a unique id (WhatsApp list rows must not repeat ids)', () => {
  const result = expressFlow.selectTvModel('img_1');

  const ids = result.options.map((option) => option.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('selectTvModel keeps every option id within WhatsApp\'s 200-char row id limit (#131009)', () => {
  const result = expressFlow.selectTvModel('img_1');

  for (const option of result.options) {
    assert.ok(option.id.length <= 200, `id too long (${option.id.length}): ${option.id}`);
  }
});

test('selectTvModel encodes the same fixed productImage/oldPrice/price edits into every option id', () => {
  const result = expressFlow.selectTvModel('img_1');

  for (const option of result.options) {
    const parsed = parseEditOptionId(option.id);
    assert.deepEqual(parsed, {
      imageId: 'img_1',
      edits: {
        productImage: expressFlow.TV_PLACEHOLDER_IMAGE_TOKEN,
        oldPrice: 33999,
        price: 27199,
      },
    });
  }
});
