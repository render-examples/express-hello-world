const test = require('node:test');
const assert = require('node:assert/strict');

const originalFetch = global.fetch;

function freshExpressAuth() {
  delete require.cache[require.resolve('./expressAuth')];
  return require('./expressAuth');
}

test('getAccessToken fetches a token from the IMS endpoint using client credentials', async () => {
  process.env.EXPRESS_CLIENT_ID = 'client-123';
  process.env.EXPRESS_CLIENT_SECRET = 'secret-456';
  global.fetch = async (url, options) => {
    assert.equal(url, 'https://ims-na1.adobelogin.com/ims/token/v3');
    assert.equal(options.method, 'POST');
    assert.equal(options.headers['Content-Type'], 'application/x-www-form-urlencoded');
    const body = options.body.toString();
    assert.match(body, /grant_type=client_credentials/);
    assert.match(body, /client_id=client-123/);
    assert.match(body, /client_secret=secret-456/);
    return { ok: true, json: async () => ({ access_token: 'tok-abc', expires_in: 86400000, token_type: 'bearer' }) };
  };

  const { getAccessToken } = freshExpressAuth();
  const token = await getAccessToken();

  assert.equal(token, 'tok-abc');
  global.fetch = originalFetch;
});

test('getAccessToken caches the token and does not refetch on a second call', async () => {
  process.env.EXPRESS_CLIENT_ID = 'client-123';
  process.env.EXPRESS_CLIENT_SECRET = 'secret-456';
  let fetchCalls = 0;
  global.fetch = async () => {
    fetchCalls += 1;
    return { ok: true, json: async () => ({ access_token: 'tok-cached', expires_in: 86400000 }) };
  };

  const { getAccessToken } = freshExpressAuth();
  const first = await getAccessToken();
  const second = await getAccessToken();

  assert.equal(first, 'tok-cached');
  assert.equal(second, 'tok-cached');
  assert.equal(fetchCalls, 1);
  global.fetch = originalFetch;
});

test('getAccessToken refetches once the cached token is within 60s of expiring', async () => {
  process.env.EXPRESS_CLIENT_ID = 'client-123';
  process.env.EXPRESS_CLIENT_SECRET = 'secret-456';
  let fetchCalls = 0;
  global.fetch = async () => {
    fetchCalls += 1;
    return { ok: true, json: async () => ({ access_token: `tok-${fetchCalls}`, expires_in: 30000 }) };
  };

  const { getAccessToken } = freshExpressAuth();
  const first = await getAccessToken();
  const second = await getAccessToken();

  assert.equal(first, 'tok-1');
  assert.equal(second, 'tok-2');
  assert.equal(fetchCalls, 2);
  global.fetch = originalFetch;
});

test('getAccessToken throws with the status and body when the IMS endpoint errors', async () => {
  process.env.EXPRESS_CLIENT_ID = 'client-123';
  process.env.EXPRESS_CLIENT_SECRET = 'secret-456';
  global.fetch = async () => ({ ok: false, status: 401, text: async () => 'invalid client' });

  const { getAccessToken } = freshExpressAuth();
  await assert.rejects(() => getAccessToken(), /401/);
  global.fetch = originalFetch;
});

test('buildAuthHeaders returns Authorization and X-API-KEY headers', async () => {
  process.env.EXPRESS_CLIENT_ID = 'client-789';
  process.env.EXPRESS_CLIENT_SECRET = 'secret-000';
  global.fetch = async () => ({ ok: true, json: async () => ({ access_token: 'tok-xyz', expires_in: 86400000 }) });

  const { buildAuthHeaders } = freshExpressAuth();
  const headers = await buildAuthHeaders();

  assert.deepEqual(headers, { Authorization: 'Bearer tok-xyz', 'X-API-KEY': 'client-789' });
  global.fetch = originalFetch;
});
