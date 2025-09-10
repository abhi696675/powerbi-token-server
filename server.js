const express = require("express");
const axios = require("axios");

const TENANT_ID = process.env.TENANT_ID;
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;


const app = express();

let cachedToken = null;
let expiry = null;

async function getAccessToken() {
  if (cachedToken && expiry > Date.now()) {
    return cachedToken;
  }

  const resp = await axios.post(
    `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`,
    new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      scope: "https://analysis.windows.net/powerbi/api/.default",
      grant_type: "client_credentials"
    })
  );

  cachedToken = resp.data.access_token;
  expiry = Date.now() + (resp.data.expires_in - 300) * 1000; // refresh 5 min before expiry
  return cachedToken;
}

app.get("/get-embed-token", async (req, res) => {
  try {
    const token = await getAccessToken();
    res.json({ token });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch token", details: err.message });
  }
});

// ✅ Important: Render uses dynamic port
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
