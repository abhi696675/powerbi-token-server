const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ Values environment से लेंगे
const tenantId = process.env.TENANT_ID;
const clientId = process.env.CLIENT_ID;
const clientSecret = process.env.CLIENT_SECRET;
const workspaceId = process.env.WORKSPACE_ID;
const reportId = process.env.REPORT_ID;

app.use(cors());

app.get("/", (req, res) => {
  res.send("Power BI Token Server is running ✅");
});

app.get("/get-embed-token", async (req, res) => {
  try {
    // 1️⃣ Azure AD से Access Token
    const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
    const form = new URLSearchParams();
    form.append("grant_type", "client_credentials");
    form.append("client_id", clientId);
    form.append("client_secret", clientSecret);
    form.append("scope", "https://analysis.windows.net/powerbi/api/.default");

    const aadTokenResp = await axios.post(tokenUrl, form);
    const accessToken = aadTokenResp.data.access_token;

    // 2️⃣ Power BI से Embed Token
    const embedUrl = `https://api.powerbi.com/v1.0/myorg/groups/${workspaceId}/reports/${reportId}/GenerateToken`;

    const embedResp = await axios.post(
      embedUrl,
      { accessLevel: "view" },
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    res.json({ token: embedResp.data.token });
  } catch (err) {
    console.error("❌ Error generating token:", err.response?.data || err.message);
    res.status(500).json({ error: "Failed to fetch token" });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
