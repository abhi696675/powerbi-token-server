const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ Enable CORS for all requests
app.use(cors());

// Root check
app.get("/", (req, res) => {
  res.send("Power BI Token Server is running ✅");
});

// Get Embed Token endpoint
app.get("/get-embed-token", async (req, res) => {
  try {
    // 👉 यहाँ आप Microsoft API call कर सकते हैं,
    // फिलहाल demo के लिए dummy token भेज रहे हैं:
    res.json({ token: "DUMMY-TOKEN" });

    // अगर आपको असली Azure से लेना है तो यहाँ axios.post(...) से कॉल लगेगा
  } catch (err) {
    console.error("Error generating token:", err.message);
    res.status(500).json({ error: "Failed to fetch token" });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
