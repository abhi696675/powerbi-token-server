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
  expiry = Date.now() + (resp.data.expires_in - 300) * 1000;
  return cachedToken;
}

app.get("/get-embed-token", async (req, res) => {
  const token = await getAccessToken();
  res.json({ token });
});

app.listen(3000, () => console.log("✅ Server running on http://localhost:3000"));
