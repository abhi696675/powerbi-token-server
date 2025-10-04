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

// ----------------- BASE URL -----------------
const baseUrl = process.env.RENDER_EXTERNAL_URL || "http://localhost:3000";
console.log("🌍 Base URL in use:", baseUrl);

// ----------------- HELPERS -----------------
function saveReport() {
  try {
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log("💾 Report saved locally");
  } catch (err) {
    console.error("❌ Failed to save report locally:", err.message);
  }
}

function applyThemeLocal(colorHex) {
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

// ----------------- MAIN HANDLER -----------------
async function handleAICommand(aiResult) {
  try {
    switch (aiResult.action) {

      // ============ THEME ============
      case "applyTheme": {
        const colorHex = aiResult.colorHex || aiResult.colorName || "#8B1E2C"; // default coffee brown
        console.log(`🎨 Applying theme: ${colorHex}`);
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
          console.error("❌ API theme update failed:", err.message);
          applyThemeLocal(colorHex);
        }
        return { action: "applyTheme", color: colorHex };
      }

      // ============ ADD KPI CARD ============
      case "addCard": {
        if (!report.cards) report.cards = [];
        report.cards.push({
          type: "kpi",
          title: aiResult.title || aiResult.metric || "New Card",
          dax: aiResult.dax || "SUM('Coffee Detail'[Caffeine (mg)])"
        });
        saveReport();
        console.log(`📊 New card added: ${aiResult.title || aiResult.metric}`);
        return { action: "addCard", metric: aiResult.metric };
      }

      // ============ COMPARE ============
      case "compare": {
        const v1 = aiResult.vendor1;
        const v2 = aiResult.vendor2;
        const metric = aiResult.metric || "Caffeine (mg)";

        console.log(`📊 Comparing vendors: ${v1} vs ${v2} by ${metric}`);

        const dax = `
          EVALUATE
          SUMMARIZECOLUMNS(
            'Coffee Detail'[Vendor],
            FILTER(
              'Coffee Detail',
              'Coffee Detail'[Vendor] IN {"${v1}", "${v2}"}
            ),
            "${metric}", SUM('Coffee Detail'[${metric}])
          )
        `;

        const resp = await axios.post(`${baseUrl}/voice-query`, { dax });
        return { action: "compare", vendor1: v1, vendor2: v2, metric, result: resp.data };
      }

      // ============ TOPN ============
      case "topN": {
  const n = aiResult.n || 5;
  const column = aiResult.column || "Caffeine (mg)";

  // 🔥 Special handling for sugar keywords
  const col = column.toLowerCase().includes("sugar") ? "Sugars (g)" : column;

  const dax = `EVALUATE TOPN(${n}, 'Coffee Detail', 'Coffee Detail'[${col}], DESC)`;
  console.log(`☕ Fetching Top ${n} by ${col}`);
  const resp = await axios.post(`${baseUrl}/voice-query`, { dax });
  return { action: "topN", column: col, result: resp.data };
}

      case "topCaffeine": {
  const n = aiResult.n || 5;
  const dax = `EVALUATE TOPN(${n}, 'Coffee Detail', 'Coffee Detail'[Caffeine (mg)], DESC)`;
  console.log("☕ Fetching Top Caffeine");
  const resp = await axios.post(`${baseUrl}/voice-query`, { dax });
  return { action: "topCaffeine", column: "Caffeine (mg)", result: resp.data }; // ✅ Added column
}

case "topSugar": {
  const n = aiResult.n || 5;
  const dax = `EVALUATE TOPN(${n}, 'Coffee Detail', 'Coffee Detail'[Sugars (g)], DESC)`;
  console.log("🍬 Fetching Top Sugar");
  const resp = await axios.post(`${baseUrl}/voice-query`, { dax });
  return { action: "topSugar", column: "Sugars (g)", result: resp.data }; // ✅ Added column
}

      // ============ MIN / MAX ============
      case "maxValue": {
        const column = aiResult.column || "Caffeine (mg)";
        const dax = `EVALUATE TOPN(1, 'Coffee Detail', 'Coffee Detail'[${column}], DESC)`;
        const resp = await axios.post(`${baseUrl}/voice-query`, { dax });
        return { action: "maxValue", column, result: resp.data };
      }

      case "minValue": {
        const column = aiResult.column || "Caffeine (mg)";
        const dax = `EVALUATE TOPN(1, 'Coffee Detail', 'Coffee Detail'[${column}], ASC)`;
        const resp = await axios.post(`${baseUrl}/voice-query`, { dax });
        return { action: "minValue", column, result: resp.data };
      }

      // ============ SAFE DRINK ============
      case "safeDrink": {
        const age = aiResult.age || 18;
        const dax = `
          EVALUATE
          FILTER(
            'Coffee Detail',
            'Coffee Detail'[Caffeine (mg)] <= CALCULATE(
              MAX('AgeSafeLimit'[Safe Caffeine]),
              'AgeSafeLimit'[Age] = ${age}
            )
          )
        `;
        console.log(`🛡️ Safe drinks for age ${age}`);
        const resp = await axios.post(`${baseUrl}/voice-query`, { dax });
        return { action: "safeDrink", age, result: resp.data };
      }

      // ============ FILTER ============
      case "filter": {
        const val = aiResult.value;
        const dax = `
          EVALUATE
          FILTER('Coffee Detail', 'Coffee Detail'[Category] = "${val}")
        `;
        console.log(`🔎 Filtering drinks by: ${val}`);
        const resp = await axios.post(`${baseUrl}/voice-query`, { dax });
        return { action: "filter", value: val, result: resp.data };
      }

      // ============ CALORIES vs SUGAR ============
      case "compareCaloriesSugar": {
        const dax = `
          EVALUATE
          SUMMARIZECOLUMNS(
            'Coffee Detail'[Vendor],
            "Calories", SUM('Coffee Detail'[Calories]),
            "Sugar", SUM('Coffee Detail'[Sugars (g)])
          )
        `;
        console.log("⚖️ Comparing Calories with Sugar across vendors");
        const resp = await axios.post(`${baseUrl}/voice-query`, { dax });
        return { action: "compareCaloriesSugar", result: resp.data };
      }

      // ============ TEXT SIZE ============
      case "textSize": {
        console.log(`🔠 Text size change: ${aiResult.change}`);
        return { action: "textSize", change: aiResult.change };
      }

      // ============ DEFAULT ============
      default:
        console.warn("⚠️ Unknown AI action:", aiResult.action);
        return { action: "unknown", raw: aiResult };
    }
  } catch (err) {
    console.error("❌ Error in handleAICommand:", err.message);
    return { error: true, message: err.message };
  }
}

module.exports = { handleAICommand };
