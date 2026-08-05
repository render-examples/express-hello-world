const test = require('node:test');
const assert = require('node:assert/strict');
const {
  getTaggedDocument,
  generateVariation,
  getJobStatus,
  pollJobStatus,
  collectTaggedElements,
  formatAllowedEdits,
  pagesForEdits,
  buildPreferredDocumentName,
} = require('./expressApi');

const originalFetch = global.fetch;

function stubFetch(handlers) {
  global.fetch = async (url, options) => {
    if (url.includes('ims-na1.adobelogin.com')) {
      return { ok: true, json: async () => ({ access_token: 'tok-test', expires_in: 86400000 }) };
    }
    for (const [pattern, handler] of handlers) {
      if (pattern.test(url)) return handler(url, options);
    }
    throw new Error(`Unexpected fetch call: ${url}`);
  };
}

test('getTaggedDocument fetches and returns the tagged document', async () => {
  process.env.EXPRESS_CLIENT_ID = 'client-1';
  process.env.EXPRESS_CLIENT_SECRET = 'secret-1';
  stubFetch([
    [/\/beta\/tagged-documents\//, async (url, options) => {
      assert.match(url, /\/beta\/tagged-documents\/urn%3Aaaid%3Asc%3AAP%3Aabc$/);
      assert.equal(options.headers.Authorization, 'Bearer tok-test');
      assert.equal(options.headers['X-API-KEY'], 'client-1');
      return { ok: true, json: async () => ({ name: 'Croma2-Doc', id: 'urn:aaid:sc:AP:abc', documentPages: [] }) };
    }],
  ]);

  const doc = await getTaggedDocument('urn:aaid:sc:AP:abc');

  assert.equal(doc.name, 'Croma2-Doc');
  global.fetch = originalFetch;
});

test('getTaggedDocument throws with the status and body on a non-ok response', async () => {
  process.env.EXPRESS_CLIENT_ID = 'client-1';
  process.env.EXPRESS_CLIENT_SECRET = 'secret-1';
  stubFetch([
    [/\/beta\/tagged-documents\//, async () => ({ ok: false, status: 404, text: async () => 'not found' })],
  ]);

  await assert.rejects(() => getTaggedDocument('urn:missing'), /404/);
  global.fetch = originalFetch;
});

test('generateVariation posts the right body and returns jobId/statusUrl', async () => {
  process.env.EXPRESS_CLIENT_ID = 'client-1';
  process.env.EXPRESS_CLIENT_SECRET = 'secret-1';
  stubFetch([
    [/\/beta\/generate-variation$/, async (url, options) => {
      assert.equal(options.method, 'POST');
      const body = JSON.parse(options.body);
      assert.deepEqual(body, {
        id: 'urn:doc:1',
        variationDetails: {
          pages: '1',
          preferredDocumentName: 'Croma Earbuds-edit-123',
          tagMappings: { cta: '20% off' },
        },
      });
      return { ok: true, json: async () => ({ jobId: 'job-1', statusUrl: 'https://express-api.adobe.io/status/job-1' }) };
    }],
  ]);

  const result = await generateVariation('urn:doc:1', { cta: '20% off' }, '1', 'Croma Earbuds-edit-123');

  assert.deepEqual(result, { jobId: 'job-1', statusUrl: 'https://express-api.adobe.io/status/job-1' });
  global.fetch = originalFetch;
});

test('getJobStatus fetches the exact statusUrl provided, with no reconstruction', async () => {
  process.env.EXPRESS_CLIENT_ID = 'client-1';
  process.env.EXPRESS_CLIENT_SECRET = 'secret-1';
  const statusUrl = 'https://express-api.adobe.io/status/job-1';
  stubFetch([
    [/\/status\/job-1$/, async (url) => {
      assert.equal(url, statusUrl);
      return {
        ok: true,
        json: async () => ({ jobId: 'job-1', status: 'succeeded', document: { name: 'GD2.express', id: 'urn:doc:2', thumbnailUrl: 'https://example.com/thumb.png' } }),
      };
    }],
  ]);

  const result = await getJobStatus(statusUrl);

  assert.equal(result.status, 'succeeded');
  assert.equal(result.document.thumbnailUrl, 'https://example.com/thumb.png');
  global.fetch = originalFetch;
});

test('pollJobStatus resolves once status is succeeded', async () => {
  process.env.EXPRESS_CLIENT_ID = 'client-1';
  process.env.EXPRESS_CLIENT_SECRET = 'secret-1';
  const statusUrl = 'https://express-api.adobe.io/status/job-2';
  let calls = 0;
  stubFetch([
    [/\/status\/job-2$/, async (url) => {
      assert.equal(url, statusUrl);
      calls += 1;
      const status = calls < 2 ? 'running' : 'succeeded';
      return {
        ok: true,
        json: async () => ({
          jobId: 'job-2',
          status,
          document: status === 'succeeded' ? { thumbnailUrl: 'https://example.com/thumb2.png' } : undefined,
        }),
      };
    }],
  ]);

  const result = await pollJobStatus(statusUrl, { intervalMs: 1, timeoutMs: 1000 });

  assert.equal(result.status, 'succeeded');
  assert.equal(calls, 2);
  global.fetch = originalFetch;
});

test('pollJobStatus throws when status is failed', async () => {
  process.env.EXPRESS_CLIENT_ID = 'client-1';
  process.env.EXPRESS_CLIENT_SECRET = 'secret-1';
  const statusUrl = 'https://express-api.adobe.io/status/job-3';
  stubFetch([
    [/\/status\/job-3$/, async () => ({ ok: true, json: async () => ({ jobId: 'job-3', status: 'failed' }) })],
  ]);

  await assert.rejects(
    () => pollJobStatus(statusUrl, { intervalMs: 1, timeoutMs: 1000 }),
    (err) => err.message === `Express job at ${statusUrl} failed`
  );
  global.fetch = originalFetch;
});

test('pollJobStatus throws once the timeout elapses without succeeding', async () => {
  process.env.EXPRESS_CLIENT_ID = 'client-1';
  process.env.EXPRESS_CLIENT_SECRET = 'secret-1';
  const statusUrl = 'https://express-api.adobe.io/status/job-4';
  stubFetch([
    [/\/status\/job-4$/, async () => ({ ok: true, json: async () => ({ jobId: 'job-4', status: 'running' }) })],
  ]);

  await assert.rejects(
    () => pollJobStatus(statusUrl, { intervalMs: 5, timeoutMs: 20 }),
    (err) => /timed out/.test(err.message) && err.message.includes(statusUrl)
  );
  global.fetch = originalFetch;
});

test('collectTaggedElements flattens taggedElements across all pages with pageNumber attached', () => {
  const doc = {
    documentPages: [
      { pageNumber: 1, taggedElements: [{ name: 'heading', type: 'text', value: 'Hi' }] },
      { pageNumber: 2, taggedElements: [{ name: 'footer', type: 'text', value: 'Bye' }] },
    ],
  };

  const elements = collectTaggedElements(doc);

  assert.deepEqual(elements, [
    { name: 'heading', type: 'text', value: 'Hi', pageNumber: 1 },
    { name: 'footer', type: 'text', value: 'Bye', pageNumber: 2 },
  ]);
});

test('formatAllowedEdits lists text elements with their current value and non-text elements with just their type', () => {
  const elements = [
    { name: 'heading', type: 'text', value: 'Hi', pageNumber: 1 },
    { name: 'logo', type: 'image', pageNumber: 1 },
  ];

  const message = formatAllowedEdits('Croma Earbuds', elements);

  assert.match(message, /Edits allowed on "Croma Earbuds":/);
  assert.match(message, /- heading: currently "Hi"/);
  assert.match(message, /- logo \(image\)/);
});

test('pagesForEdits returns the sorted, comma-joined page numbers containing the edited fields', () => {
  const elements = [
    { name: 'heading', pageNumber: 2 },
    { name: 'cta', pageNumber: 1 },
    { name: 'footer', pageNumber: 1 },
  ];

  assert.equal(pagesForEdits(elements, ['cta']), '1');
  assert.equal(pagesForEdits(elements, ['cta', 'heading']), '1,2');
});

test('buildPreferredDocumentName appends a timestamp suffix to the base name', () => {
  const name = buildPreferredDocumentName('Croma Earbuds');
  assert.match(name, /^Croma Earbuds-edit-\d+$/);
});
