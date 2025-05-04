require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

// Create Express app
const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(cors());

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || "mongodb+srv://mmluser-ro:1wzBCKHp2hBMCi69@clustermetamindinglab.qa8tyi1.mongodb.net/mmldb")
  .then(() => console.log("Connected to MongoDB"))
  .catch(err => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });

// Routes
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date() });
});

// Login route
app.post("/api/auth/login", (req, res) => {
  res.json({ token: "demo-token-for-testing" });
});

// Query route
app.post("/api/query", async (req, res) => {
  try {
    const { query, collection = "events" } = req.body;
    console.log("Query:", query);
    
    const lowerQuery = query.toLowerCase();
    const db = mongoose.connection.db;
    
    // Zone engagement query
    if (lowerQuery.includes("zone") && lowerQuery.includes("engagement")) {
      console.log("Detected zone engagement query");
      
      // Step 1: Find zones with highest player engagement
      const topZones = await db.collection("events").aggregate([
        { $match: { "context.zoneId": { $exists: true } } },
        { $group: {
          _id: "$context.zoneId",
          playerCount: { $addToSet: "$playerId" }
        }},
        { $project: {
          zoneId: "$_id",
          playerEngagement: { $size: "$playerCount" },
          _id: 0
        }},
        { $sort: { playerEngagement: -1 } },
        { $limit: 5 }
      ]).toArray();
      
      // Step 2: Get item pickups for these zones
      const zoneIds = topZones.map(zone => zone.zoneId);
      const itemPickups = await db.collection("events").aggregate([
        { $match: { 
          "context.zoneId": { $in: zoneIds },
          "type": "item",
          "context.action": "pickup"
        }},
        { $group: {
          _id: "$context.zoneId",
          itemPickupCount: { $sum: 1 }
        }}
      ]).toArray();
      
      // Step 3: Combine the results
      const results = topZones.map(zone => {
        const pickups = itemPickups.find(p => p._id === zone.zoneId);
        return {
          zoneId: zone.zoneId,
          playerEngagement: zone.playerEngagement,
          itemPickups: pickups ? pickups.itemPickupCount : 0
        };
      });
      
      return res.json({
        query,
        results,
        explanation: "Specialized zone engagement query"
      });
    }
    
    // Default fallback
    else {
      console.log("Using default fallback");
      
      const results = await db.collection(collection).find().limit(20).toArray();
      
      return res.json({
        query,
        results,
        explanation: "Default fallback query"
      });
    }
  } catch (error) {
    console.error("Query execution error:", error);
    res.status(500).json({ message: "Query execution failed", error: error.message });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
