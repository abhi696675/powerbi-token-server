const axios = require("axios");
const fs = require("fs");
const path = require("path");

async function commitAndPush(message) {
  try {
    const token = process.env.GITHUB_TOKEN;
    const owner = "abhi696675"; // 👈 tumhara GitHub username
    const repo = "powerbi-token-server"; // 👈 repo ka naam
    const branch = "main";

    // File path to push
    const filePath = "Coffee.Report/report.json";
    const fullPath = path.join(__dirname, "../Coffee.Report/report.json");

    // File content read
    const content = fs.readFileSync(fullPath, "utf8");

    // GitHub API URL
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;

    // Step 1: Get current file SHA
    let sha = null;
    try {
      const { data } = await axios.get(url, {
        headers: { Authorization: `token ${token}` }
      });
      sha = data.sha;
    } catch (err) {
      console.log("ℹ️ File not found in repo, creating new one.");
    }

    // Step 2: Create / Update file
    await axios.put(
      url,
      {
        message,
        content: Buffer.from(content).toString("base64"),
        sha,
        branch
      },
      {
        headers: {
          Authorization: `token ${token}`,
          "Content-Type": "application/json"
        }
      }
    );

    console.log("✅ Report pushed to GitHub successfully!");
  } catch (err) {
    console.error("❌ GitHub push failed:", err.response?.data || err.message);
  }
}

module.exports = { commitAndPush };
