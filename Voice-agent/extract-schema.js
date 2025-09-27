const fs = require("fs");
const path = require("path");

// Path to your Power BI PBIP report.json or dataset.json
const reportPath = path.join(__dirname, "../Coffee.Report/report.json");

function extractSchema() {
  try {
    const report = JSON.parse(fs.readFileSync(reportPath, "utf-8"));

    const schema = { tables: {} };

    // Loop over all tables
    if (report.model && report.model.tables) {
      for (const table of report.model.tables) {
        const tableName = table.name;
        schema.tables[tableName] = { columns: [], distinctValues: {} };

        // Add column names
        if (table.columns) {
          schema.tables[tableName].columns = table.columns.map(c => c.name);
        }
      }
    }

    // Save schema.json
    const schemaPath = path.join(__dirname, "../Coffee.Report/schema.json");
    fs.writeFileSync(schemaPath, JSON.stringify(schema, null, 2));

    console.log("✅ Schema extracted successfully:", schemaPath);
  } catch (err) {
    console.error("❌ Failed to extract schema:", err.message);
  }
}

extractSchema();
