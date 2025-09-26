const axios = require("axios");
const fs = require("fs");
const path = require("path");

// Local PBIP file (fallback mode)
const reportPath = path.join(__dirname, "../Coffee.Report/report.json");
let report = {};
try {
  report = JSON.parse(fs.readFileSync(reportPath, "utf-8"));
  console.log("📄 Report loaded successfully!");
} catch (err) {
  console.warn("⚠️ Local report not found, fallback only:", err.message);
}

// ----------------- LOCAL FUNCTIONS -----------------
function applyTheme(colorHex) {
  report.theme = {
    name: `Custom Theme ${colorHex}`,
    dataColors: [colorHex, "#A0522D", "#CD853F"],
    background: colorHex,
    foreground: "#2E2E2E",
    tableAccent: colorHex
  };
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`✅ Local theme applied: ${colorHex}`);
}

// ----------------- AI STRUCTURED HANDLER -----------------
async function handleAICommand(aiResult) {
  if (aiResult.action === "applyTheme") {
    console.log(`🎨 Applying theme via API: ${aiResult.colorHex}`);

    await axios.post("http://localhost:3000/update-theme", {
      name: "AI Theme",
      dataColors: [aiResult.colorHex, "#A0522D", "#CD853F"],
      background: aiResult.colorHex,
      foreground: "#2E2E2E",
      tableAccent: aiResult.colorHex
    });

    console.log("✅ Theme updated in Power BI Service");
  }
}

// ----------------- FALLBACK (Keyword Mode) -----------------
function runCommand(command) {
  console.log("⚡ Fallback command:", command);

  if (command.includes("theme")) {
    const color = command.match(/#([0-9A-Fa-f]{6})/);
    if (color) {
      applyTheme(color[0]);
    } else {
      console.warn("❌ Please provide a hex color e.g. #8B1E2C");
    }
  } else {
    console.warn("⚠️ Command not recognized:", command);
  }
}

module.exports = { runCommand, handleAICommand };
