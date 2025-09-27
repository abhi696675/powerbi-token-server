require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cors = require("cors");
const { commitAndPush } = require("./Voice-agent/git-helper");
const { runCommand, handleAICommand } = require("./Voice-agent/patch");
const { callAzureOpenAI } = require("./Voice-agent/azure-llm");
const { processCommand } = require("./Voice-agent/command-processor"); // ✅ नया import

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// =============================
// Env Vars (Power BI + Azure OpenAI)
// =============================
const tenantId = process.env.AZURE_TENANT_ID;
const clientId = process.env.AZURE_CLIENT_ID;
const clientSecret = process.env.AZURE_CLIENT_SECRET;
const workspaceId = process.env.PBI_WORKSPACE_ID;
const reportId = process.env.PBI_REPORT_ID;
const datasetId = process.env.PBI_DATASET_ID;

// =============================
// Root Check
// =============================
app.get("/", (req, res) => {
  res.send("✅ Power BI Token + Voice Agent + Azure OpenAI Server is running");
});

// =============================
// Azure AD Access Token
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
// Embed Token
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
// Refresh Dataset
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
// Update Report Theme
// =============================
app.post("/update-theme", async (req, res) => {
  try {
    const token = await getAccessToken();

    const themePayload = {
      themeJson: {
        name: req.body.name || "Custom Theme",
        dataColors: req.body.dataColors || ["#8B1E2C", "#A0522D", "#CD853F"],
        background: req.body.background || "#FFFFFF",
        foreground: req.body.foreground || "#2E2E2E",
        tableAccent: req.body.tableAccent || "#8B1E2C"
      }
    };

    console.log("🎨 Updating theme with payload:", themePayload);

    await axios.post(
      `https://api.powerbi.com/v1.0/myorg/groups/${workspaceId}/reports/${reportId}/UpdateTheme`,
      themePayload,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    res.json({ message: "🎨 Theme updated directly in Power BI Service!" });
  } catch (err) {
    console.error("❌ Error updating theme:", err.response?.data || err.message);
    res.status(500).json({ error: "Failed to update theme" });
  }
});

// =============================
// Run DAX Query on Dataset (voice-query)
// =============================
app.post("/voice-query", async (req, res) => {
  try {
    const token = await getAccessToken();
    const daxQuery =
      req.body.dax ||
      "EVALUATE TOPN(5, 'Coffee Detail', 'Coffee Detail'[Caffeine (mg)], DESC)";

    const queryUrl = `https://api.powerbi.com/v1.0/myorg/groups/${workspaceId}/datasets/${datasetId}/executeQueries`;
    const queryPayload = { queries: [{ query: daxQuery }] };

    console.log("📊 Executing DAX Query:", daxQuery);

    const resp = await axios.post(queryUrl, queryPayload, {
      headers: { Authorization: `Bearer ${token}` }
    });

    res.json({ dax: daxQuery, result: resp.data });
  } catch (err) {
    console.error("❌ Error executing DAX query:", err.response?.data || err.message);
    res.status(500).json({ error: "Failed to run DAX query" });
  }
});

// =============================
// Voice Command (AI + Processor)
// =============================
app.post("/voice-command", async (req, res) => {
  const cmd = (req.body.command || "").toLowerCase();
  console.log("📥 Voice-command received:", cmd);

  try {
    // 1. Try AI parse
    const aiResult = await callAzureOpenAI(cmd);
    console.log("🤖 AI parsed response:", aiResult);

    let actionResult = null;

    if (aiResult.action) {
      // AI structured action
      console.log("✅ Running AI action:", aiResult.action);
      actionResult = await handleAICommand(aiResult);
    } else {
      // Fallback → custom processor
      console.log("⚠️ No AI action, falling back to command-processor");
      actionResult = await processCommand(cmd, {
        vendors: ["Costa", "Starbucks", "Pret", "Greggs", "Caffè Nero"],
      });
    }

    // Git commit
    commitAndPush(`Voice command executed: ${cmd}`);

    return res.json({
      status: "ok",
      aiResult,
      actionResult,
      message: `⚡ Command executed successfully: ${cmd}`
    });
  } catch (err) {
    console.error("❌ Error executing voice-command:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
});

// =============================
// Azure OpenAI Chat (Free-form)
// =============================
app.post("/chat", async (req, res) => {
  try {
    const userPrompt = req.body.prompt || "Hello, test message!";
    const aiResult = await callAzureOpenAI(userPrompt);

    res.json({ reply: aiResult });
  } catch (err) {
    console.error("❌ Azure OpenAI error:", err.response?.data || err.message);
    res.status(500).json({ error: "Failed to connect to Azure OpenAI" });
  }
});

// =============================
// Start Server
// =============================
app.listen(PORT, () => {
  const baseUrl = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
  console.log(`🚀 Server running on ${baseUrl}`);
});
