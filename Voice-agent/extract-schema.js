const { ConfidentialClientApplication } = require("@azure/msal-node");
const axios = require("axios");
const fs = require("fs");
require("dotenv").config();

const tenantId = process.env.AZURE_TENANT_ID;
const clientId = process.env.AZURE_CLIENT_ID;
const clientSecret = process.env.AZURE_CLIENT_SECRET;
const workspaceId = process.env.PBI_WORKSPACE_ID;
const datasetId = process.env.PBI_DATASET_ID;

const config = {
  auth: {
    clientId,
    authority: `https://login.microsoftonline.com/${tenantId}`,
    clientSecret,
  }
};

const cca = new ConfidentialClientApplication(config);

async function getToken() {
  const result = await cca.acquireTokenByClientCredential({
    scopes: ["https://analysis.windows.net/powerbi/api/.default"],
  });
  return result.accessToken;
}

async function extractSchema() {
  try {
    const token = await getToken();

    // Normal dataset metadata
    const url = `https://api.powerbi.com/v1.0/myorg/groups/${workspaceId}/datasets/${datasetId}`;

    const resp = await axios.get(url, {
      headers: { Authorization: `Bearer ${token}` }
    });

    fs.writeFileSync("schema.json", JSON.stringify(resp.data, null, 2));
    console.log("✅ Schema saved to schema.json");
  } catch (err) {
    console.error("❌ Error extracting schema:", err.response?.data || err.message);
  }
}

extractSchema();
