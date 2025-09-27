const axios = require("axios");
require("dotenv").config();
const fs = require("fs");
const path = require("path");

// ✅ Schema load kare (agar available hai)
let schema = {};
try {
  const schemaPath = path.join(__dirname, "../Coffee.Report/schema.json");
  schema = JSON.parse(fs.readFileSync(schemaPath, "utf-8"));
  console.log("📄 Schema loaded for AI context");
} catch (err) {
  console.warn("⚠️ Schema.json not found, running without schema context");
}

async function callAzureOpenAI(prompt) {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const key = process.env.AZURE_OPENAI_KEY;
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT;

  const url = `${endpoint}openai/deployments/${deployment}/chat/completions?api-version=2025-04-01-preview`;

  try {
    const response = await axios.post(
      url,
      {
        messages: [
          {
            role: "system",
            content: `
              You are a JSON command generator for a Power BI report editor.
              Always respond ONLY with a valid JSON object.
              Never include explanations, markdown, or text outside JSON.

              Dataset schema (for reference):
              ${JSON.stringify(schema, null, 2)}

              Supported actions:
              1. { "action": "applyTheme", "colorHex": "#RRGGBB" }
              2. { "action": "addCard", "page": "Overview", "title": "Caffeine Safe Limit", "measureRef": "Measures.[Safe Caffeine Limit (mg/day)]" }
              3. { "action": "compare", "vendor1": "Costa", "vendor2": "Starbucks", "metric": "Caffeine (mg)" }
              4. { "action": "topSugar" }
              5. { "action": "topCaffeine" }
            `
          },
          { role: "user", content: prompt }
        ],
        max_completion_tokens: 300,
        temperature: 1 // ✅ deterministic JSON output
      },
      {
        headers: {
          "Content-Type": "application/json",
          "api-key": key,
        },
      }
    );

    let aiMessage = response.data.choices?.[0]?.message?.content?.trim() || "{}";

    try {
      const parsed = JSON.parse(aiMessage);
      if (!parsed.action) {
        console.warn("⚠️ AI returned JSON but missing action:", parsed);
        return { error: "No action found", raw: parsed };
      }
      return parsed;
    } catch (jsonErr) {
      console.error("⚠️ Failed to parse AI JSON:", aiMessage);
      return { error: "Invalid JSON from AI", raw: aiMessage };
    }

  } catch (err) {
    console.error("❌ Azure OpenAI API error:", err.response?.data || err.message);
    return { error: "AI request failed" };
  }
}

module.exports = { callAzureOpenAI };
