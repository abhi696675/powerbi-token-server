const axios = require("axios");
const baseUrl = process.env.RENDER_EXTERNAL_URL || "http://localhost:3000";

/**
 * Process natural voice/text commands → structured Power BI actions
 */
async function processCommand(command, schema) {
  const cmd = command.toLowerCase();
  console.log("🎤 Processing command:", cmd);

  // ---------------- TOPN ----------------
  if (cmd.includes("top")) {
    const n = parseInt(cmd.match(/\d+/)?.[0] || "5");
    let column = "Caffeine (mg)";
    if (cmd.includes("sugar")) column = "Sugars (g)";
    if (cmd.includes("calorie")) column = "Calories";

    const dax = `EVALUATE TOPN(${n}, 'Coffee Detail', 'Coffee Detail'[${column}], DESC)`;
    const resp = await axios.post(`${baseUrl}/voice-query`, { dax });
    return { action: "topN", column, result: resp.data };
  }

  // ---------------- COMPARE ----------------
  if (cmd.includes("compare")) {
    const vendors = schema.vendors || ["Costa", "Starbucks", "Pret", "Greggs", "Caffè Nero"];
    const v1 = vendors.find(v => cmd.includes(v.toLowerCase())) || "Costa";
    const v2 = vendors.find(v => cmd.includes(v.toLowerCase()) && v !== v1) || "Starbucks";

    let metric = "Caffeine (mg)";
    if (cmd.includes("sugar")) metric = "Sugars (g)";
    if (cmd.includes("calorie")) metric = "Calories";

    const dax = `
      EVALUATE
      SUMMARIZECOLUMNS(
        'Coffee Detail'[Vendor],
        "Value", SUM('Coffee Detail'[${metric}])
      )
    `;
    const resp = await axios.post(`${baseUrl}/voice-query`, { dax });
    return { action: "compare", vendor1: v1, vendor2: v2, metric, result: resp.data };
  }

  // ---------------- MAX/MIN ----------------
  if (cmd.includes("highest") || cmd.includes("max")) {
    let column = "Caffeine (mg)";
    if (cmd.includes("sugar")) column = "Sugars (g)";
    if (cmd.includes("calorie")) column = "Calories";

    const dax = `EVALUATE TOPN(1, 'Coffee Detail', 'Coffee Detail'[${column}], DESC)`;
    const resp = await axios.post(`${baseUrl}/voice-query`, { dax });
    return { action: "maxValue", column, result: resp.data };
  }

  if (cmd.includes("lowest") || cmd.includes("min")) {
    let column = "Caffeine (mg)";
    if (cmd.includes("sugar")) column = "Sugars (g)";
    if (cmd.includes("calorie")) column = "Calories";

    const dax = `EVALUATE TOPN(1, 'Coffee Detail', 'Coffee Detail'[${column}], ASC)`;
    const resp = await axios.post(`${baseUrl}/voice-query`, { dax });
    return { action: "minValue", column, result: resp.data };
  }

  // ---------------- FILTER ----------------
  if (cmd.includes("show only") || cmd.includes("filter")) {
    let filterVal = "Latte";
    if (cmd.includes("cold")) filterVal = "Cold Drinks";
    if (cmd.includes("latte")) filterVal = "Latte";

    const dax = `
      EVALUATE
      FILTER('Coffee Detail', 'Coffee Detail'[Category] = "${filterVal}")
    `;
    const resp = await axios.post(`${baseUrl}/voice-query`, { dax });
    return { action: "filter", value: filterVal, result: resp.data };
  }

  // ---------------- THEME ----------------
  if (cmd.includes("theme")) {
    let color = "#8B1E2C"; // default coffee brown
    if (cmd.includes("dark")) color = "#000000";
    if (cmd.includes("light")) color = "#FFFFFF";
    if (cmd.includes("green")) color = "#097143";

    await axios.post(`${baseUrl}/update-theme`, {
      name: "AI Theme",
      dataColors: [color, "#A0522D", "#CD853F"],
      background: color,
      foreground: "#2E2E2E",
      tableAccent: color
    });

    return { action: "applyTheme", color };
  }

  // ---------------- TEXT SIZE ----------------
  if (cmd.includes("text size") || cmd.includes("font")) {
    if (cmd.includes("increase")) return { action: "textSize", change: "increase" };
    if (cmd.includes("decrease")) return { action: "textSize", change: "decrease" };
  }

  // ---------------- SAFE DRINK (Age-based) ----------------
  if (cmd.includes("safe drink") || cmd.includes("safe")) {
    const age = parseInt(cmd.match(/\d+/)?.[0] || "18");
    const dax = `
      EVALUATE
      FILTER(
        'Coffee Detail',
        'Coffee Detail'[Caffeine (mg)] <= CALCULATE(MAX('AgeSafeLimit'[Safe Caffeine]), 'AgeSafeLimit'[Age] = ${age})
      )
    `;
    const resp = await axios.post(`${baseUrl}/voice-query`, { dax });
    return { action: "safeDrink", age, result: resp.data };
  }

  // ---------------- COMPARE CALORIES WITH SUGAR ----------------
  if (cmd.includes("compare calories with sugar")) {
    const dax = `
      EVALUATE
      SUMMARIZECOLUMNS(
        'Coffee Detail'[Vendor],
        "Calories", SUM('Coffee Detail'[Calories]),
        "Sugar", SUM('Coffee Detail'[Sugars (g)])
      )
    `;
    const resp = await axios.post(`${baseUrl}/voice-query`, { dax });
    return { action: "compareCaloriesSugar", result: resp.data };
  }

  // ---------------- DEFAULT ----------------
  return { action: "unknown", raw: command };
}

module.exports = { processCommand };
