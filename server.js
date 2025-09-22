const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ Env Vars
const tenantId = process.env.TENANT_ID;
const clientId = process.env.CLIENT_ID;
const clientSecret = process.env.CLIENT_SECRET;
const workspaceId = process.env.WORKSPACE_ID;
const reportId = process.env.REPORT_ID;

app.use(cors());

// 🔹 Cache storage
let cachedEmbedToken = null;
let cachedEmbedExpiry = null;

// =============================
// Root Check
// =============================
app.get("/", (req, res) => {
  res.send("Power BI Token Server is running ✅");
});

// =============================
// Embed Token Route (with cache)
// =============================
app.get("/get-embed-token", async (req, res) => {
  try {
    const now = Date.now();

    // If cached token is still valid → reuse it
    if (cachedEmbedToken && cachedEmbedExpiry && now < cachedEmbedExpiry) {
      console.log("♻️ Returning cached embed token");
      return res.json({ token: cachedEmbedToken });
    }

    // Azure AD token
    const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
    const form = new URLSearchParams();
    form.append("grant_type", "client_credentials");
    form.append("client_id", clientId);
    form.append("client_secret", clientSecret);
    form.append("scope", "https://analysis.windows.net/powerbi/api/.default");

    const aadTokenResp = await axios.post(tokenUrl, form);
    const accessToken = aadTokenResp.data.access_token;

    // Embed token
    const embedUrl = `https://api.powerbi.com/v1.0/myorg/groups/${workspaceId}/reports/${reportId}/GenerateToken`;
    const embedResp = await axios.post(
      embedUrl,
      { accessLevel: "view" },
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    // Store in cache
    cachedEmbedToken = embedResp.data.token;
    cachedEmbedExpiry = now + (embedResp.data.expiration
      ? (new Date(embedResp.data.expiration).getTime() - 60000) // if API gives expiry, use it
      : 55 * 60 * 1000); // otherwise assume 55 mins safe window

    console.log("✅ New embed token generated");
    res.json({ token: cachedEmbedToken });

  } catch (err) {
    console.error("❌ Error generating token:", err.response?.data || err.message);
    res.status(500).json({ error: "Failed to fetch token" });
  }
});
