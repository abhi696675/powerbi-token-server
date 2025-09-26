const axios = require("axios");
require("dotenv").config();

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
          { role: "system", content: "You are a JSON command generator for a Power BI report editor." },
          { role: "user", content: prompt }
        ],
        max_completion_tokens: 300 // ✅ Correct param
        // ❌ Removed response_format (not supported in Azure Chat API)
      },
      {
        headers: {
          "Content-Type": "application/json",
          "api-key": key,
        },
      }
    );

    // ✅ Extract AI result safely
    const aiMessage = response.data.choices?.[0]?.message?.content || "{}";
    return JSON.parse(aiMessage);

  } catch (err) {
    console.error("❌ Azure OpenAI API error:", err.response?.data || err.message);
    return { error: "AI request failed" };
  }
}

module.exports = { callAzureOpenAI };
