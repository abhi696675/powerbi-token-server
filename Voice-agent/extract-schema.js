const axios = require("axios");
const fs = require("fs");
require("dotenv").config();

const tenantId = process.env.TENANT_ID;
const clientId = process.env.CLIENT_ID;
const clientSecret = process.env.CLIENT_SECRET;
const datasetId = process.env.DATASET_ID;
const workspaceId = process.env.WORKSPACE_ID;

// ---------------- Get Azure Access Token ----------------
async function getAccessToken() {
  const resp = await axios.post(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
      scope: "https://analysis.windows.net/powerbi/api/.default"
    })
  );
  return resp.data.access_token;
}

// ---------------- Extract Schema ----------------
async function extractSchema() {
  try {
    const token = await getAccessToken();
    const url = `https://api.powerbi.com/v1.0/myorg/groups/${workspaceId}/datasets/${datasetId}/tables`;

    const resp = await axios.get(url, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const schema = { tables: resp.data.value };
    fs.writeFileSync("Coffee.Report/schema.json", JSON.stringify(schema, null, 2));
    console.log("✅ Schema extracted successfully! File: Coffee.Report/schema.json");
  } catch (err) {
    console.error("❌ Error extracting schema:", err.response?.data || err.message);
  }
}

extractSchema();
