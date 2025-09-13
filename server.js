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

// =============================
// 1️⃣ Root Check
// =============================
app.get("/", (req, res) => {
  res.send("Power BI Token Server is running ✅");
});

// =============================
// 2️⃣ Generate Embed Token
// =============================
app.get("/get-embed-token", async (req, res) => {
  try {
    // Azure AD Token
    const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
    const form = new URLSearchParams();
    form.append("grant_type", "client_credentials");
    form.append("client_id", clientId);
    form.append("client_secret", clientSecret);
    form.append("scope", "https://analysis.windows.net/powerbi/api/.default");

    const aadTokenResp = await axios.post(tokenUrl, form);
    const accessToken = aadTokenResp.data.access_token;

    // Embed Token
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

// =============================
// Helper: Get Access Token (Azure AD)
// =============================
async function getAccessToken() {
  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  const form = new URLSearchParams();
  form.append("grant_type", "client_credentials");
  form.append("client_id", clientId);
  form.append("client_secret", clientSecret);
  form.append("scope", "https://analysis.windows.net/powerbi/api/.default");

  const resp = await axios.post(tokenUrl, form);
  return resp.data.access_token;
}

// =============================
// 3️⃣ Export Report (PDF/PPTX)
// =============================
app.get("/export-report", async (req, res) => {
  try {
    const token = await getAccessToken();
    const format = req.query.format || "PDF"; // default PDF

    // Step 1: Start Export Job
    const exportResp = await axios.post(
      `https://api.powerbi.com/v1.0/myorg/reports/${reportId}/ExportTo`,
      { format },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const exportId = exportResp.data.id;

    // Step 2: Polling until complete
    let fileBuffer;
    while (true) {
      const statusResp = await axios.get(
        `https://api.powerbi.com/v1.0/myorg/reports/${reportId}/exports/${exportId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (statusResp.data.status === "Succeeded") {
        const fileResp = await axios.get(statusResp.data.resourceLocation, {
          responseType: "arraybuffer",
          headers: { Authorization: `Bearer ${token}` }
        });
        fileBuffer = fileResp.data;
        break;
      } else if (statusResp.data.status === "Failed") {
        throw new Error("Export failed");
      }
      await new Promise(r => setTimeout(r, 3000)); // 3 sec delay
    }

    // Step 3: Send File
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=Report.${format.toLowerCase()}`
    );
    res.send(fileBuffer);

  } catch (err) {
    console.error("❌ Error exporting report:", err.response?.data || err.message);
    res.status(500).json({ error: "Failed to export report" });
  }
});

// =============================
// 4️⃣ Start Server
// =============================
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
