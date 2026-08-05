// Router-level tests for actions.js — image resolution, not-found handling, and
// deterministic dispatch by image.source. Flow behavior itself is covered in
// expressFlow.test.js and localFlow.test.js.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { actionCreateDesign, actionCheckAllowedEdits, actionEditGraphic } = require('./actions');

function writeFixtureCatalog(entries) {
  const fixturePath = path.join(os.tmpdir(), `express-templates-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  fs.writeFileSync(fixturePath, JSON.stringify(entries));
  process.env.EXPRESS_TEMPLATES_FILE = fixturePath;
}

function writeOnamFixture() {
  const onam = {
    images: { base: 'https://cdn.test/b.png', final: 'https://cdn.test/f.png', malayalam: 'https://cdn.test/m.png' },
    palette: [{ name: 'Marigold', hex: '#F4A300' }],
    slots: { editable: [{ name: 'address', type: 'text', aliases: [] }], locked: [] },
  };
  const p = path.join(os.tmpdir(), `onam-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  fs.writeFileSync(p, JSON.stringify(onam));
  process.env.ONAM_DESIGN_FILE = p;
}

test('actionCheckAllowedEdits reports unknown images without throwing', async () => {
  writeFixtureCatalog([{ id: 'img_1', name: 'Croma Earbuds', docId: 'urn:doc:1' }]);

  const reply = await actionCheckAllowedEdits('phone-r1', 'img_nope');

  assert.match(reply, /couldn't find that image/);
});

test('actionEditGraphic reports unknown images without throwing', async () => {
  writeFixtureCatalog([{ id: 'img_1', name: 'Croma Earbuds', docId: 'urn:doc:1' }]);

  const reply = await actionEditGraphic('phone-r2', 'img_nope', { x: 'y' }, { sendImage: async () => {} });

  assert.match(reply, /couldn't find that image/);
});

test('routes a local-source image to the canned flow (no Express API call)', async () => {
  writeOnamFixture();
  const sent = [];
  const sendImage = async (_to, link) => sent.push(link);
  await actionCreateDesign('phone-r3', { occasion: 'Onam' }, { sendImage });

  const reply = await actionEditGraphic('phone-r3', 'local_1', { address: 'MG Road' }, { sendImage });

  assert.match(reply.historyText, /anything else/i);
  assert.equal(sent.at(-1), 'https://cdn.test/f.png'); // canned "final" URL — proves the local flow ran
});
