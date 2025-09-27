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

// ----------------- BASE URL (local vs Render) -----------------
const baseUrl = process.env.RENDER_EXTERNAL_URL || "http://localhost:3000";
console.log("🌍 Base URL in use:", baseUrl);

// ----------------- COLOR DICTIONARY -----------------
const colorMap = {
  white: "#FFFFFF",
  black: "#000000",
  red: "#FF0000",
  green: "#00FF00",
  blue: "#0000FF",
  brown: "#8B4513",
  "coffee brown": "#8B1E2C",
  "dark brown": "#654321",
  yellow: "#FFFF00",
  orange: "#FFA500",
  gray: "#808080",
  "light mode": "#FFFFFF",
  "dark mode": "#000000"
};

// ----------------- LOCAL HELPERS -----------------
function saveReport() {
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log("💾 Report saved locally");
}

function applyTheme(colorHex) {
  report.theme = {
    name: `Custom Theme ${colorHex}`,
    dataColors: [colorHex, "#A0522D", "#CD853F"],
    background: colorHex,
    foreground: "#2E2E2E",
    tableAccent: colorHex
  };
  saveReport();
  console.log(`✅ Local theme applied: ${colorHex}`);
}

function addCard(metricName, daxFormula) {
  if (!report.cards) report.cards = [];
  report.cards.push({
    type: "kpi",
    title: metricName,
    dax: daxFormula
  });
  saveReport();
  console.log(`📊 New card added: ${metricName}`);
}

function addComparison(metric, dimension) {
  if (!report.comparisons) report.comparisons = [];
  report.comparisons.push({
    metric,
    dimension
  });
  saveReport();
  console.log(`🔁 Comparison added: ${metric} by ${dimension}`);
}

function resolveColor(input) {
  if (!input) return "#FFFFFF"; // default white
  const key = input.toLowerCase().trim();
  return colorMap[key] || input; // fallback: assume hex
}

// ----------------- AI STRUCTURED HANDLER -----------------
async function handleAICommand(aiResult) {
  try {
    switch (aiResult.action) {
      case "applyTheme": {
        const colorHex = resolveColor(aiResult.colorHex || aiResult.colorName);
        console.log(`🎨 Applying theme via API: ${colorHex}`);
        try {
          await axios.post(`${baseUrl}/update-theme`, {
            name: "AI Theme",
            dataColors: [colorHex, "#A0522D", "#CD853F"],
            background: colorHex,
            foreground: "#2E2E2E",
            tableAccent: colorHex
          });
          console.log("✅ Theme updated in Power BI Service");
        } catch (err) {
          console.error("❌ API theme update failed, applying locally:", err.message);
          applyTheme(colorHex); // fallback local theme
        }
        return { action: "applyTheme", color: colorHex };
      }

      case "addCard": {
        addCard(aiResult.metric, aiResult.dax || "SUM('Coffee Detail'[Caffeine (mg)])");
        return { action: "addCard", metric: aiResult.metric };
      }

      case "compare":
      case "createComparison":
      case "compareVendors": {
        const daxQuery =
          aiResult.dax ||
          `EVALUATE SUMMARIZECOLUMNS(
              'Coffee Detail'[Vendor],
              "${aiResult.metric || "Caffeine (mg)"}",
              SUM('Coffee Detail'[${aiResult.metric || "Caffeine (mg)"}])
          )`;

        console.log("🔁 Running comparison DAX:", daxQuery);

        const resp = await axios.post(`${baseUrl}/voice-query`, { dax: daxQuery });
        addComparison(aiResult.metric || "Caffeine", "Vendor");

        return { action: "compare", metric: aiResult.metric, result: resp.data };
      }

      case "topCaffeine": {
        const daxQuery =
          aiResult.dax ||
          "EVALUATE TOPN(5, 'Coffee Detail', 'Coffee Detail'[Caffeine (mg)], DESC)";

        console.log("☕ Fetching Top Caffeine products with DAX:", daxQuery);

        const resp = await axios.post(`${baseUrl}/voice-query`, { dax: daxQuery });
        return { action: "daxQuery", type: "topCaffeine", result: resp.data };
      }

      case "topSugar": {
        const daxQuery =
          aiResult.dax ||
          "EVALUATE TOPN(5, 'Coffee Detail', 'Coffee Detail'[Sugars (g)], DESC)";

        console.log("🍬 Fetching Top Sugar products with DAX:", daxQuery);

        const resp = await axios.post(`${baseUrl}/voice-query`, { dax: daxQuery });
        return { action: "daxQuery", type: "topSugar", result: resp.data };
      }

      default:
        console.warn("⚠️ Unknown AI action:", aiResult.action);
        return { action: "unknown", raw: aiResult };
    }
  } catch (err) {
    console.error("❌ Error in handleAICommand:", err.message);
    return { error: true, message: err.message };
  }
}

// ----------------- FALLBACK (Keyword Mode) -----------------
function runCommand(command) {
  console.log("⚡ Fallback command:", command);
  const lower = command.toLowerCase();

  if (lower.includes("theme")) {
    let foundColor = null;
    for (const key of Object.keys(colorMap)) {
      if (lower.includes(key)) {
        foundColor = colorMap[key];
        break;
      }
    }
    if (foundColor) {
      applyTheme(foundColor);
    } else {
      console.warn("❌ No valid color found. Try: white, black, coffee brown...");
    }
  } else if (lower.includes("top caffeine")) {
    addCard("Top Caffeine", "TOPN(5, 'Coffee Detail', 'Coffee Detail'[Caffeine (mg)], DESC)");
  } else if (lower.includes("top sugar")) {
    addCard("Top Sugar", "TOPN(5, 'Coffee Detail', 'Coffee Detail'[Sugars (g)], DESC)");
  } else if (lower.includes("compare")) {
    addComparison("Caffeine", "Vendor");
  } else {
    console.warn("⚠️ Command not recognized:", command);
  }
}

module.exports = { runCommand, handleAICommand };
