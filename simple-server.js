require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(cors());

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch(err => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });

// Routes
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date() });
});

// Query route for item pickup
app.post("/api/query", async (req, res) => {
  try {
    const { query, collection = "events" } = req.body;

    if (!query) {
      return res.status(400).json({ message: "Query is required" });
    }

    console.log("Processing query:", query);
    console.log("Collection:", collection);

    // Hardcoded pipeline for item pickup query
    let pipeline = [];
    let explanation = "Direct pipeline generation";

    // Check if this is the item pickup query
    const lowerQuery = query.toLowerCase();
    if (lowerQuery.includes("item") && lowerQuery.includes("pickup") && collection === "events") {
      console.log("Detected item pickup query");
      
      // Extract limit from query (default to 5 if not specified)
      let limit = 5;
      const limitMatch = lowerQuery.match(/top\s+(\d+)/);
      if (limitMatch) {
        limit = parseInt(limitMatch[1]);
      }
      
      pipeline = [
        { $match: { 
          type: "item",
          "context.action": "pickup"
        }},
        { $group: {
          _id: "$context.itemId",
          count: { $sum: 1 }
        }},
        { $lookup: {
          from: "items",
          localField: "_id",
          foreignField: "_id",
          as: "itemDetails"
        }},
        { $unwind: { path: "$itemDetails", preserveNullAndEmptyArrays: true } },
        { $project: {
          itemId: "$_id",
          itemName: "$itemDetails.name",
          count: 1,
          _id: 0
        }},
        { $sort: { count: -1 } },
        { $limit: limit }
      ];
      
      explanation = "Specialized pipeline for item pickup query";
    } else {
      // Default fallback pipeline
      pipeline = [{ $match: {} }, { $limit: 20 }];
      explanation = "Default fallback pipeline";
    }

    // Get the specified collection
    const db = mongoose.connection.db;
    const mongoCollection = db.collection(collection);

    // Execute the aggregation pipeline
    console.log("Executing pipeline:", JSON.stringify(pipeline));
    const results = await mongoCollection.aggregate(pipeline).toArray();
    console.log(`Query returned ${results.length} results`);

    // Return response
    res.json({
      query,
      timestamp: new Date(),
      results,
      processedQuery: `db.${collection}.aggregate(${JSON.stringify(pipeline)})`,
      pipeline: pipeline,
      explanation: explanation
    });
  } catch (error) {
    console.error("Query execution error:", error);
    res.status(500).json({ message: "Query execution failed", error: error.message });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
