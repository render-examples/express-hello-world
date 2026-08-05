const IMS_TOKEN_URL = process.env.EXPRESS_IMS_TOKEN_URL || 'https://ims-na1.adobelogin.com/ims/token/v3';
const DEFAULT_SCOPE = 'ee.express_api,openid,AdobeID,read_organizations,additional_info.projectedProductContext';
const REFRESH_MARGIN_MS = 60_000;

let cachedToken = null; // { accessToken, expiresAt }

async function getAccessToken() {
  if (cachedToken && cachedToken.expiresAt - Date.now() > REFRESH_MARGIN_MS) {
    return cachedToken.accessToken;
  }

  const response = await fetch(IMS_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: process.env.EXPRESS_CLIENT_ID,
      client_secret: process.env.EXPRESS_CLIENT_SECRET,
      scope: process.env.EXPRESS_API_SCOPE || DEFAULT_SCOPE,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`IMS token request failed ${response.status}: ${text}`);
  }

  const data = await response.json();
  cachedToken = {
    accessToken: data.access_token,
    expiresAt: Date.now() + Number(data.expires_in),
  };
  return cachedToken.accessToken;
}

async function buildAuthHeaders() {
  const token = await getAccessToken();
  return {
    Authorization: `Bearer ${token}`,
    'X-API-KEY': process.env.EXPRESS_CLIENT_ID,
  };
}

module.exports = { getAccessToken, buildAuthHeaders };
