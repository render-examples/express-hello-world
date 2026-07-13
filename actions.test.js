const test = require('node:test');
const assert = require('node:assert/strict');
const { actionCheckAllowedEdits, actionEditGraphic } = require('./actions');
const { getTrackedImages } = require('./imageStore');

test('actionCheckAllowedEdits lists the unlocked layers for a known image', async () => {
  const reply = await actionCheckAllowedEdits('phone-1', 'img_1');
  assert.match(reply, /Diwali Offer Banner/);
  assert.match(reply, /discount_text/);
});

test('actionCheckAllowedEdits lists Price, Address, Product Image, Partner Logo for the Croma earbuds image', async () => {
  const reply = await actionCheckAllowedEdits('phone-croma', 'img_3');
  assert.match(reply, /Croma Earbuds/);
  assert.match(reply, /- Price/);
  assert.match(reply, /- Address/);
  assert.match(reply, /- Product Image/);
  assert.match(reply, /- Partner Logo/);
});

test('actionCheckAllowedEdits reports unknown images without throwing', async () => {
  const reply = await actionCheckAllowedEdits('phone-2', 'img_nope');
  assert.match(reply, /couldn't find that image/);
});

test('actionEditGraphic rejects edits outside the unlocked layers and sends nothing', async () => {
  let sendImageCalled = false;
  const sendImage = async () => {
    sendImageCalled = true;
  };

  const reply = await actionEditGraphic('phone-3', 'img_3', { background_color: 'red' }, { sendImage });

  assert.match(reply, /can't edit background_color/);
  assert.equal(sendImageCalled, false);
});

test('actionEditGraphic sends the fixed updated Croma earbuds image for any allowed edit', async () => {
  const sentCalls = [];
  const sendImage = async (to, link) => {
    sentCalls.push({ to, link });
  };

  const reply = await actionEditGraphic('phone-5', 'img_3', { Price: '999' }, { sendImage });

  assert.match(reply, /Updated "Croma Earbuds"/);
  assert.equal(sentCalls.length, 1);
  assert.equal(sentCalls[0].link, 'https://s7ap1.scene7.com/is/image/varun/croma1-earbuds-updated');
});

test('actionEditGraphic applies an allowed edit, sends the updated image, and remembers the edit', async () => {
  const sentCalls = [];
  const sendImage = async (to, link) => {
    sentCalls.push({ to, link });
  };

  const reply = await actionEditGraphic('phone-4', 'img_2', { headline: 'Flash Sale' }, { sendImage });

  assert.match(reply, /Updated "Summer Sale Flyer"/);
  assert.equal(sentCalls.length, 1);
  assert.equal(sentCalls[0].to, 'phone-4');
  assert.match(sentCalls[0].link, /^https:\/\/mock-meta-cdn\.local\//);

  const image = getTrackedImages('phone-4').find((img) => img.id === 'img_2');
  assert.equal(image.currentEdits.headline, 'Flash Sale');
});
