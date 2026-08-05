const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const localFlow = require('./localFlow');
const { findTrackedImage } = require('./imageStore');

const FIXTURE = {
  images: {
    en: 'https://cdn.test/banner-en.png',
    hi: 'https://cdn.test/banner-hi.png',
  },
  plans: ['3-Yr Comprehensive', 'Zero Dep + RSA', 'Engine Protect combo'],
  featured: { plan: '3-Yr Comprehensive', price: '₹28,999/year', was: '₹52,499/year', savings: '₹23,500/year' },
  slots: {
    editable: [{ name: 'language', type: 'text', aliases: ['lang', 'translate', 'headline'] }],
    locked: ['logo', 'price', 'plan'],
  },
};

function useFixture() {
  const p = path.join(os.tmpdir(), `offer-design-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  fs.writeFileSync(p, JSON.stringify(FIXTURE));
  process.env.OFFER_DESIGN_FILE = p;
}

// Captures both the image link and its caption.
function captureSendImage() {
  const sent = [];
  return { sendImage: async (_to, link, caption) => sent.push({ link, caption }), sent };
}

// Create an offer for a phone (English image sent) and return its tracked image.
async function setup(phone, args = { customer: 'Apoorva', model: 'Grand Vitara', plan: '3-Yr Comprehensive' }) {
  useFixture();
  const { sendImage, sent } = captureSendImage();
  await localFlow.createDesign(phone, args, { sendImage });
  return { image: findTrackedImage(phone, 'local_1'), sendImage, sent };
}

test('createDesign sends the English creative with a personalised caption', async () => {
  useFixture();
  const { sendImage, sent } = captureSendImage();

  const reply = await localFlow.createDesign(
    'auto-1',
    { customer: 'Apoorva', model: 'Grand Vitara', plan: '3-Yr Comprehensive', includeContact: true },
    { sendImage }
  );

  assert.equal(sent[0].link, FIXTURE.images.en);
  assert.match(sent[0].caption, /Apoorva/);
  assert.match(sent[0].caption, /Grand Vitara/);
  assert.match(sent[0].caption, /change anything/i);
  assert.equal(reply.skipSend, true);
});

test('createDesign streams progress (naming the model + contact) before the image', async () => {
  useFixture();
  process.env.GEN_STEP_DELAY_MS = '0'; // no real pause in tests
  const texts = [];
  const { sendImage, sent } = captureSendImage();

  await localFlow.createDesign(
    'auto-2',
    { customer: 'Apoorva', model: 'Grand Vitara', plan: '3-Yr Comprehensive', includeContact: true },
    { sendImage, sendText: async (_t, m) => texts.push(m) }
  );

  assert.ok(texts.length >= 4, 'streams several progress messages');
  assert.ok(texts.some((m) => /Grand Vitara/.test(m)), 'names the model');
  assert.ok(texts.some((m) => /contact/i.test(m)), 'mentions the contact step');
  assert.equal(sent[0].link, FIXTURE.images.en);
});

test('editGraphic translates to the Hindi creative when Devanagari text is passed', async () => {
  const { image, sent } = await setup('auto-3');

  await localFlow.editGraphic('auto-3', image, { headline: 'नमस्ते अपूर्वा' }, { sendImage: async (_t, l, c) => sent.push({ link: l, caption: c }) });

  assert.equal(sent.at(-1).link, FIXTURE.images.hi);
  assert.match(sent.at(-1).caption, /Hindi/);
});

test('editGraphic translates to Hindi when the word "Hindi" is used under any key', async () => {
  const { image, sent } = await setup('auto-4');

  await localFlow.editGraphic('auto-4', image, { language: 'Hindi' }, { sendImage: async (_t, l, c) => sent.push({ link: l, caption: c }) });

  assert.equal(sent.at(-1).link, FIXTURE.images.hi);
});

test('editGraphic streams Hindi progress before sending the Hindi image', async () => {
  process.env.GEN_STEP_DELAY_MS = '0';
  const { image } = await setup('auto-5');
  const texts = [];
  const sent = [];

  await localFlow.editGraphic('auto-5', image, { language: 'Hindi' }, {
    sendImage: async (_t, l, c) => sent.push({ link: l, caption: c }),
    sendText: async (_t, m) => texts.push(m),
  });

  assert.ok(texts.some((m) => /Hindi/i.test(m)));
  assert.equal(sent.at(-1).link, FIXTURE.images.hi);
});

test('editGraphic keeps the English creative for a non-language edit', async () => {
  const { image, sent } = await setup('auto-6');

  await localFlow.editGraphic('auto-6', image, { note: 'add urgency' }, { sendImage: async (_t, l, c) => sent.push({ link: l, caption: c }) });

  assert.equal(sent.at(-1).link, FIXTURE.images.en);
});

test('checkAllowedEdits lists the editable slots from the schema', async () => {
  const { image } = await setup('auto-7');

  const result = localFlow.checkAllowedEdits(image);

  assert.equal(result.type, 'edit_options');
  assert.deepEqual(result.options.map((o) => o.title), ['🌐 Change language']);
});

test('getOfferContext exposes the approved plans and featured governance', () => {
  useFixture();

  const ctx = localFlow.getOfferContext();

  assert.deepEqual(ctx.plans, FIXTURE.plans);
  assert.equal(ctx.featured.price, '₹28,999/year');
});
