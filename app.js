// app.js — Delete/Anonymize Account API for B2BWave
const express = require('express');
const app = express();

app.use(express.json());

// Lexo nga Environment Variables (i vendose te Render)
const B2B_BASE = process.env.B2B_BASE;        // p.sh. https://na01.safelinks.protection.outlook.com/?url=https%3A%2F%2Fphillydessertsfactory.b2bwave.com%2Fapi&data=05%7C02%7C%7C583bc0d9c465404ef82808de03a5326c%7C84df9e7fe9f640afb435aaaaaaaaaaaa%7C1%7C0%7C638952205202121913%7CUnknown%7CTWFpbGZsb3d8eyJFbXB0eU1hcGkiOnRydWUsIlYiOiIwLjAuMDAwMCIsIlAiOiJXaW4zMiIsIkFOIjoiTWFpbCIsIldUIjoyfQ%3D%3D%7C0%7C%7C%7C&sdata=C1iImEBisLzC%2BjnBOPvV%2BKBp8%2BMS%2B272NiDC0ahP1hg%3D&reserved=0
const B2B_API_KEY = process.env.B2B_API_KEY;  // API key "Delete Account Key"

// Helper për thirrje të sigurta te B2BWave
async function b2b(path, opts = {}) {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${B2B_API_KEY}`,
    ...(opts.headers || {})
  };

  // Përdor fetch-in e Node 18+ (Render e ka). Nëse del error "fetch not defined",
  // shto pakon node-fetch dhe bëj: const fetch = (...args)=>import('node-fetch').then(({default:f})=>f(...args))
  const res = await fetch(`${B2B_BASE}${path}`, { ...opts, headers });
  if (res.status === 204) return null;
  const text = await res.text();
  try { return { ok: res.ok, status: res.status, json: JSON.parse(text) }; }
  catch { return { ok: res.ok, status: res.status, text }; }
}

// Healthcheck
app.get('/', (_req, res) => {
  res.send('Delete Account API është gati ✅');
});

// Funksioni kryesor: fshi ose anonimizo sipas porosive ekzistuese
async function deleteOrAnonymize(customerId) {
  // 1) Kontrollo nëse ka porosi (marrim vetëm 1 për shpejtësi)
  const ordersResp = await b2b(`/orders?customer_id=${encodeURIComponent(customerId)}&per_page=1`);
  if (!ordersResp?.ok) {
    throw new Error(`S’muar porositë (status ${ordersResp?.status})`);
  }
  const hasOrders = Array.isArray(ordersResp.json) ? ordersResp.json.length > 0
                  : Array.isArray(ordersResp.json?.data) ? ordersResp.json.data.length > 0
                  : false;

  if (!hasOrders) {
    // 2A) S’ka porosi → Fshi klientin
    const del = await b2b(`/customers/${encodeURIComponent(customerId)}`, { method: 'DELETE' });
    if (del?.ok || del === null) return { action: 'deleted' };
    throw new Error(`Fshirja dështoi (status ${del?.status})`);
  } else {
    // 2B) Ka porosi → Anonimizo + ç’aktivizo hyrjen
    const suffix = Date.now();
    const body = {
      name: 'Deleted user',
      email: `deleteduser+${suffix}@example.invalid`,
      phone: '',
      status: 'inactive'
    };
    const upd = await b2b(`/customers/${encodeURIComponent(customerId)}`, {
      method: 'PATCH', body: JSON.stringify(body)
    });
    if (upd?.ok) return { action: 'anonymized' };
    // disa API mund të kërkojnë PUT në vend të PATCH — provojmë fallback
    const updPut = await b2b(`/customers/${encodeURIComponent(customerId)}`, {
      method: 'PUT', body: JSON.stringify(body)
    });
    if (updPut?.ok) return { action: 'anonymized' };
    throw new Error(`Anonimizimi dështoi (status ${upd?.status || updPut?.status})`);
  }
}

// 2 mënyra për ta thirrur nga app-i yt:
// a) DELETE /delete-account/:customerId
app.delete('/delete-account/:customerId', async (req, res) => {
  try {
    const result = await deleteOrAnonymize(req.params.customerId);
    res.json({ success: true, ...result });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// b) POST /delete-account  { "customerId": "123" }
app.post('/delete-account', async (req, res) => {
  try {
    const { customerId } = req.body || {};
    if (!customerId) return res.status(400).json({ error: 'customerId mungon' });
    const result = await deleteOrAnonymize(customerId);
    res.json({ success: true, ...result });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));