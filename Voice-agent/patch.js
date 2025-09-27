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

// ----------------- LOCAL FUNCTIONS -----------------
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

        await axios.post(`${baseUrl}/update-theme`, {
          name: "AI Theme",
          dataColors: [colorHex, "#A0522D", "#CD853F"],
          background: colorHex,
          foreground: "#2E2E2E",
          tableAccent: colorHex
        });

        console.log("✅ Theme updated in Power BI Service");
        break;
      }

      case "addCard": {
        console.log(`📊 Adding new card: ${aiResult.metric}`);
        addCard(aiResult.metric, aiResult.dax || "SUM('Coffee Detail'[Caffeine (mg)])");
        break;
      }

      case "compare": {
        console.log(`🔁 Adding comparison: ${aiResult.metric} by ${aiResult.dimension}`);
        addComparison(aiResult.metric, aiResult.dimension);
        break;
      }

      case "topCaffeine": {
        console.log("☕ Fetching Top Caffeine products");
        await axios.post(`${baseUrl}/voice-query`, {
          dax: "TOPN(5, 'Coffee Detail', 'Coffee Detail'[Caffeine (mg)], DESC)"
        });
        break;
      }

      case "topSugar": {
        console.log("🍬 Fetching Top Sugar products");
        await axios.post(`${baseUrl}/voice-query`, {
          dax: "TOPN(5, 'Coffee Detail', 'Coffee Detail'[Sugars (g)], DESC)"
        });
        break;
      }

      default:
        console.warn("⚠️ Unknown AI action:", aiResult.action);
    }
  } catch (err) {
    console.error("❌ Error in handleAICommand:", err.message);
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
