// ===== app.js (final faucet backend) =====
const fetch = global.fetch || ((...a) => import('node-fetch').then(m => m.default(...a)));
const express = require("express");
const xrpl = require("xrpl");
const app = express();

app.use(express.json());

/* ---------- CORS ---------- */
const EXACT_IPFS_ORIGIN = process.env.EXACT_IPFS_ORIGIN || "";
const UD_ORIGIN = process.env.UD_ORIGIN || "";
const ALLOW_ANY_IPFS_SUBDOMAIN = true;

function isAllowedOrigin(origin) {
  if (!origin) return false;
  if (origin === EXACT_IPFS_ORIGIN) return true;
  if (UD_ORIGIN && origin === UD_ORIGIN) return true;
  if (ALLOW_ANY_IPFS_SUBDOMAIN) {
    try { return new URL(origin).hostname.endsWith(".ipfs.dweb.link"); } catch {}
  }
  return false;
}

function setCorsHeaders(res, origin) {
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS, GET");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
}

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (isAllowedOrigin(origin)) setCorsHeaders(res, origin);
  next();
});

/* ---------- HEALTH ---------- */
app.get('/health', (_req, res) => res.json({ ok: true }));

/* ---------- SDK serve ---------- */
app.get('/sdk/xumm.min.js', async (_req, res) => {
  const r = await fetch('https://xumm.app/assets/cdn/xumm.min.js');
  res.type('application/javascript').send(await r.text());
});

app.get('/sdk/xrpl-latest-min.js', async (_req, res) => {
  const r = await fetch('https://cdnjs.cloudflare.com/ajax/libs/xrpl/3.2.0/xrpl-latest-min.js');
  res.type('application/javascript').send(await r.text());
});

/* ---------- PAY (unchanged stubs) ---------- */
app.get('/api/pay-cfc', async (_req, res) => res.json({ ok: true }));
app.get('/api/pay-xrp', async (_req, res) => res.json({ ok: true }));

/* ---------- BALANCES ---------- */
app.get('/api/balances', async (req, res) => {
  const account = (req.query.account || '').trim();
  if (!account) return res.status(400).json({ ok: false, error: 'Missing account' });
  try {
    const client = new xrpl.Client('wss://xrplcluster.com');
    await client.connect();
    let xrp = null, cfc = null, hasTrust = false;
    try {
      const ai = await client.request({ command: 'account_info', account, ledger_index: 'validated' });
      xrp = ai.result?.account_data?.Balance ? ai.result.account_data.Balance / 1_000_000 : null;
    } catch {}
    const issuer = process.env.CFC_ISSUER || process.env.ISSUER_CLASSIC;
    const currency = process.env.CFC_CURRENCY || 'CFC';
    if (issuer) {
      try {
        const al = await client.request({ command: 'account_lines', account, ledger_index: 'validated', peer: issuer });
        const line = (al.result?.lines || []).find(l => l.currency === currency);
        cfc = line ? line.balance : null;
        hasTrust = !!line;
      } catch {}
    }
    await client.disconnect();
    return res.json({ ok: true, xrp, cfc, hasTrust });
  } catch (e) {
    console.error('balances error:', e);
    return res.status(500).json({ ok: false, error: 'XRPL error' });
  }
});

/* ---------- JOIN ---------- */
app.post('/api/join', (req, res) => {
  const email = (req.body && req.body.email || '').trim();
  if (!email) return res.status(400).json({ ok: false, error: 'Missing email' });
  console.log('JOIN email:', email);
  return res.json({ ok: true });
});

/* ---------- FAUCET (real CFC send) ---------- */
const grants = new Map();

app.post('/api/faucet', async (req, res) => {
  try {
    const { account, captcha_ok } = req.body || {};
    if (!captcha_ok) return res.status(400).json({ ok: false, error: 'Captcha required' });
    if (!account || !/^r[1-9A-HJ-NP-Za-km-z]{25,34}$/.test(account)) {
      return res.status(400).json({ ok: false, error: 'Invalid account' });
    }

    // 24h rate limit
    const last = grants.get(account) || 0;
    const now = Date.now();
    if (now - last < 24 * 60 * 60 * 1000) {
      return res.status(429).json({ ok: false, error: 'Faucet already claimed (24h limit)' });
    }

    const issuer = process.env.ISSUER_CLASSIC || process.env.CFC_ISSUER;
    const seed = process.env.ISSUER_SEED || process.env.FAUCET_SEED;
    const currency = process.env.CFC_CURRENCY || 'CFC';
    const value = String(process.env.AMOUNT_CFC || '10');
    if (!issuer || !seed) {
      return res.status(500).json({ ok: false, error: 'Server faucet not configured' });
    }

    const client = new xrpl.Client(process.env.RIPPLED_URL || 'wss://s1.ripple.com');
    await client.connect();

    // Trustline check
    const al = await client.request({ command: 'account_lines', account, ledger_index: 'validated', peer: issuer });
    const hasLine = (al.result?.lines || []).some(l => l.currency === currency);
    if (!hasLine) {
      await client.disconnect();
      return res.status(400).json({ ok: false, error: 'No CFC trustline. Please add trustline first.' });
    }

    // Build tx
    const wallet = xrpl.Wallet.fromSeed(seed);
    const tx = {
      TransactionType: "Payment",
      Account: wallet.address,
      Destination: account,
      Amount: { currency, issuer, value }
    };

    // Use autofill + extended ledger window
    const filled = await client.autofill(tx);
    const { result: { ledger_index } } = await client.request({ command: "ledger", ledger_index: "validated" });
    filled.LastLedgerSequence = ledger_index + 20;

    const signed = wallet.sign(filled);
    const result = await client.submitAndWait(signed.tx_blob);

    await client.disconnect();

    if (result.result?.meta?.TransactionResult === 'tesSUCCESS') {
      grants.set(account, now);
      return res.json({ ok: true, hash: result.result?.tx_json?.hash });
    } else {
      return res.status(500).json({
        ok: false,
        error: result.result?.meta?.TransactionResult || 'Submit failed'
      });
    }
  } catch (e) {
    console.error('faucet error:', e);
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

/* ---------- ROOT ---------- */
app.get("/", (_req, res) =>
  res.type('html').send(`<!doctype html><html><body><h1>Hello from Render</h1></body></html>`)
);

/* ---------- START ---------- */
const port = process.env.PORT || 10000;
const server = app.listen(port, () => console.log(`Server listening on ${port}`));
server.keepAliveTimeout = 120000;
server.headersTimeout = 120000;

// ===== end app.js =====
