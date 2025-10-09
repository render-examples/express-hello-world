import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();

const app = express();

// cache token in memory
let cachedToken = null;
let tokenExpiry = 0;

// helper: get or refresh token
async function getAccessToken() {
  const now = Date.now();
  if (cachedToken && now < tokenExpiry - 30_000) return cachedToken;

  const res = await fetch("https://accounts-api.airthings.com/v1/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: process.env.AIRTHINGS_CLIENT_ID,
      client_secret: process.env.AIRTHINGS_CLIENT_SECRET,
      scope: [process.env.AIRTHINGS_SCOPE],
    }),
  });

  if (!res.ok) throw new Error(`Token error: ${res.status}`);
  const data = await res.json();
  cachedToken = data.access_token;
  tokenExpiry = Date.now() + data.expires_in * 1000;
  return cachedToken;
}

// endpoint to fetch latest samples
app.get("/api/latest", async (req, res) => {
  try {
    const token = await getAccessToken();
    const locationId = req.query.locationId;
    if (!locationId) {
      return res.status(400).json({ error: "locationId is required" });
    }

    const url = `https://ext-api.airthings.com/v1/locations/${locationId}/latest-samples?tempUnit=c&vocUnit=ppb`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// start server
app.listen(process.env.PORT || 3000, () => {
  console.log("✅ Backend running on port", process.env.PORT || 3000);
});
