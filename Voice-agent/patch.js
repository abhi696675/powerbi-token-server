const fs = require("fs");
const path = require("path");

// ✅ Correct path to PBIP report JSON
const reportPath = path.join(__dirname, "../Coffee.Report/report.json");

// Load report safely
let report;
try {
  report = JSON.parse(fs.readFileSync(reportPath, "utf-8"));
  console.log("📄 Report loaded successfully!");
} catch (err) {
  console.error("❌ Failed to load report file:", err.message);
  process.exit(1);
}

// ---------------- FUNCTIONS ----------------

// 1. Apply Theme
function applyTheme(colorHex) {
  report.theme = {
    name: `Custom Theme ${colorHex}`,
    dataColors: [colorHex, "#A0522D", "#CD853F"], // accent + brown tones
    background: "#FFF8F0",
    foreground: "#2E2E2E",
    tableAccent: colorHex
  };
  console.log(`✅ Theme applied: ${colorHex}`);
}

// 2. Add Card
function addCard(pageName, title, measureRef) {
  const page = report.sections.find(s => s.displayName === pageName);
  if (!page) {
    console.error("❌ Page not found: " + pageName);
    return;
  }

  if (!page.visualContainers) page.visualContainers = [];

  const card = {
    config: {
      name: `${title.replace(/\s+/g, '')}Card`,
      singleVisual: {
        visualType: "card",
        projections: { Values: [{ queryRef: measureRef }] },
        objects: {
          title: [
            {
              properties: {
                text: { expr: { Literal: { Value: `'${title}'` } } }
              }
            }
          ]
        }
      }
    },
    x: 100,
    y: 200,
    width: 200,
    height: 100
  };

  page.visualContainers.push(card);
  console.log(`✅ Card added: ${title} on ${pageName}`);
}

// 3. Create Comparison Page
function createComparisonPage(vendor1, vendor2, metricRef) {
  const newPage = {
    displayName: `${vendor1} vs ${vendor2}`,
    name: `${vendor1}${vendor2}Compare`,
    visualContainers: [
      {
        config: {
          singleVisual: {
            visualType: "clusteredColumnChart",
            projections: {
              Category: [{ queryRef: "CoffeeDetail[Product]" }],
              Series: [{ queryRef: "CoffeeDetail[Vendor]" }],
              Y: [{ queryRef: `CoffeeDetail[${metricRef}]` }]
            }
          }
        },
        x: 50,
        y: 50,
        width: 600,
        height: 400
      }
    ]
  };

  if (!report.sections) report.sections = [];
  report.sections.push(newPage);
  console.log(`✅ New comparison page created: ${vendor1} vs ${vendor2}`);
}

// ---------------- COMMAND HANDLER ----------------
function handleCommand(command) {
  const cmd = command.toLowerCase().trim();

  try {
    if (cmd.includes("theme")) {
      const color = cmd.match(/#([0-9A-Fa-f]{6})/);
      if (color) {
        applyTheme(color[0]);
      } else {
        console.error("❌ Please provide a hex color e.g. #8B1E2C");
      }

    } else if (cmd.includes("caffeine safe limit")) {
      addCard("Overview", "Caffeine Safe Limit", "Measures.[Safe Caffeine Limit (mg/day)]");

    } else if (cmd.includes("sugar safe limit")) {
      addCard("Overview", "Sugar Safe Limit", "Measures.[Safe Sugar Limit (g/day)]");

    } else if (cmd.includes("comparison")) {
      const vendors = cmd.match(/costa|starbucks|pret|greggs|nero/gi);
      if (vendors && vendors.length >= 2) {
        createComparisonPage(vendors[0], vendors[1], "Caffeine (mg)");
      } else {
        console.error("❌ Please specify two vendors (e.g. Costa vs Starbucks)");
      }

    } else {
      console.warn("⚠️ Command not recognized:", command);
    }

    // Save report back safely
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log("💾 Report saved successfully!");

  } catch (err) {
    console.error("❌ Error in handleCommand:", err.message);
  }
}

// ---------------- EXPORT FOR SERVER ----------------
function runCommand(command) {
  console.log("🎯 Running command:", command);
  handleCommand(command);
}

module.exports = { runCommand };
