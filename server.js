const express = require("express");
const axios = require("axios");
const cors = require("cors");
const { commitAndPush } = require("./Voice-agent/git-helper");
const { runCommand } = require("./Voice-agent/patch");  // 👈 Direct import

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ Env Vars
const tenantId = process.env.TENANT_ID;
const clientId = process.env.CLIENT_ID;
const clientSecret = process.env.CLIENT_SECRET;
const workspaceId = process.env.WORKSPACE_ID;
const reportId = process.env.REPORT_ID;
const datasetId = process.env.DATASET_ID;

app.use(cors());
app.use(express.json());

// =============================
// Root Check
// =============================
app.get("/", (req, res) => {
  res.send("✅ Power BI Token + Voice Agent Server is running");
});

// =============================
// Helper → Azure AD Access Token
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
// Embed Token Route
// =============================
app.get("/get-embed-token", async (req, res) => {
  try {
    const token = await getAccessToken();
    const embedUrl = `https://api.powerbi.com/v1.0/myorg/groups/${workspaceId}/reports/${reportId}/GenerateToken`;

    const embedResp = await axios.post(
      embedUrl,
      { accessLevel: "view" },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    res.json({ token: embedResp.data.token });
  } catch (err) {
    console.error("❌ Error generating token:", err.response?.data || err.message);
    res.status(500).json({ error: "Failed to fetch token" });
  }
});

// =============================
// Refresh Dataset Route
// =============================
app.post("/refresh-dataset", async (req, res) => {
  try {
    const token = await getAccessToken();

    await axios.post(
      `https://api.powerbi.com/v1.0/myorg/groups/${workspaceId}/datasets/${datasetId}/refreshes`,
      {},
      { headers: { Authorization: `Bearer ${token}` } }
    );

    res.json({ message: "🔄 Dataset refresh triggered successfully!" });
  } catch (err) {
    console.error("❌ Error refreshing dataset:", err.response?.data || err.message);
    res.status(500).json({ error: "Failed to refresh dataset" });
  }
});

// =============================
// Export Report (PDF/PPTX)
// =============================
app.get("/export-report", async (req, res) => {
  try {
    const token = await getAccessToken();
    const format = req.query.format || "PDF"; // default PDF

    const exportResp = await axios.post(
      `https://api.powerbi.com/v1.0/myorg/groups/${workspaceId}/reports/${reportId}/ExportTo`,
      { format },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const exportId = exportResp.data.id;

    // Poll until export completes
    let fileBuffer;
    while (true) {
      const statusResp = await axios.get(
        `https://api.powerbi.com/v1.0/myorg/groups/${workspaceId}/reports/${reportId}/exports/${exportId}`,
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
        throw new Error("Export failed ❌");
      }
      await new Promise(r => setTimeout(r, 3000)); // wait 3 sec
    }

    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=Report.${format.toLowerCase()}`
    );
    res.send(fileBuffer);

  } catch (err) {
    console.error("❌ Error exporting:", err.response?.data || err.message);
    res.status(500).json({ error: "Failed to export report" });
  }
});

// =============================
// Voice Command Route
// =============================
app.post("/voice-command", (req, res) => {
  const cmd = (req.body.command || "").toLowerCase();
  console.log("🎙️ Voice command:", cmd);

  try {
    // 🔹 Direct runCommand (no execSync)
    runCommand(cmd);

    // 🔹 Commit changes to GitHub
    commitAndPush(`Voice command: ${cmd}`);

    return res.json({ status: "ok", message: `⚡ Executed runCommand: ${cmd}` });
  } catch (err) {
    console.error("❌ Error executing voice-command:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
});

// =============================
// Start Server
// =============================
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
