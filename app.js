const express = require('express');
const app = express();

const port = process.env.PORT || 10000;
app.use(express.json());

// Root ping – që të mos shfaqet “Hello from Render!”
app.get('/', (req, res) => {
  res.type('text').send('Delete Account API është gati ✅');
});

// *** Shembull funksioni – ti e ke të plotë te varianti yt ***
async function deleteOrAnonymize(customerId) {
  // TODO: logjika jote ekzistuese (b2b fetch, PATCH/PUT, etj.)
  return { action: 'anonymized', customerId };
}

// DELETE /delete-account/:customerId
app.delete('/delete-account/:customerId', async (req, res) => {
  try {
    const customerId = req.params.customerId;
    const result = await deleteOrAnonymize(customerId);
    res.json({ success: true, ...result });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /delete-account   { "customerId": 289 }
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

app.listen(port, () => console.log(`Server running on ${port}`));
