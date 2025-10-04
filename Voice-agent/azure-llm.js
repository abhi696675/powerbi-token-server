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

              Supported actions (examples):
              1. { "action": "applyTheme", "colorHex": "#RRGGBB" }
              2. { "action": "addCard", "page": "Overview", "title": "Caffeine Safe Limit", "measureRef": "Measures.[Safe Caffeine Limit (mg/day)]" }
              3. { "action": "compare", "vendor1": "Costa", "vendor2": "Starbucks", "metric": "Caffeine (mg)" }
              4. { "action": "topN", "n": 10, "column": "Sugars (g)" }
              5. { "action": "topCaffeine", "n": 20, "column": "Caffeine (mg)" }
              6. { "action": "topSugar", "n": 15, "column": "Sugars (g)" }
              7. { "action": "textSize", "change": "increase" }
              8. { "action": "safeDrink", "age": 25 }
              9. { "action": "filter", "value": "Latte" }
              10. { "action": "maxValue", "column": "Caffeine (mg)" }
              11. { "action": "minValue", "column": "Sugars (g)" }
              12. { "action": "compareCaloriesSugar" }

              Important rules:
              - Always map "caffeine drink(s)" requests to { "action": "topCaffeine" }
              - Always map "sugar drink(s)" requests to { "action": "topSugar" }
              - For "topSugar" always include "column": "Sugars (g)"
              - For "topCaffeine" always include "column": "Caffeine (mg)"
              - For "topN" action, respect user-provided number (n). If not provided, default to 5.
            `
          },
          { role: "user", content: prompt }
        ],
        max_completion_tokens: 300,
        temperature: 0 // ✅ deterministic JSON output
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

      // ✅ Post-processing fallback
      if (parsed.action === "topSugar") {
        if (!parsed.column) parsed.column = "Sugars (g)";
        if (!parsed.n) parsed.n = 5;
      }

      if (parsed.action === "topCaffeine") {
        if (!parsed.column) parsed.column = "Caffeine (mg)";
        if (!parsed.n) parsed.n = 5;
      }

      if (parsed.action === "topN") {
        if (!parsed.n) parsed.n = 5;
        // Auto-convert topN -> topCaffeine/topSugar
        if (parsed.column === "Caffeine (mg)") {
          parsed.action = "topCaffeine";
        } else if (parsed.column === "Sugars (g)") {
          parsed.action = "topSugar";
        }
      }

      console.log("🎯 Final parsed action:", parsed);
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
