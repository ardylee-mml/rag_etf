require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');

// Connect to MongoDB
async function analyzeCollections() {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb+srv://mmluser-ro:1wzBCKHp2hBMCi69@clustermetamindinglab.qa8tyi1.mongodb.net/mmldb?retryWrites=true&w=majority';
    console.log('Connecting to MongoDB...');
    console.log('MongoDB URI:', mongoURI);

    await mongoose.connect(mongoURI);
    console.log('Connected to MongoDB successfully');

    // Get the database
    const db = mongoose.connection.db;

    // Collections to analyze
    const collections = ['items', 'players', 'questions', 'zones', 'leaderboards', 'events'];

    // Create a directory for the analysis results
    const outputDir = './analysis';
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir);
    }

    // Analyze each collection
    for (const collectionName of collections) {
      console.log(`\n=== ANALYZING COLLECTION: ${collectionName.toUpperCase()} ===`);

      const collection = db.collection(collectionName);

      // 1. Count documents
      const count = await collection.countDocuments();
      console.log(`Total documents: ${count}`);

      // 2. Get sample documents
      const sampleSize = Math.min(5, count);
      const samples = await collection.find().limit(sampleSize).toArray();

      if (samples.length > 0) {
        console.log('Sample document structure:');
        console.log(JSON.stringify(samples[0], null, 2));
      } else {
        console.log('No documents found in this collection');
        continue;
      }

      // 3. Analyze fields
      const allFields = new Set();
      const fieldTypes = {};
      const fieldCounts = {};

      samples.forEach(doc => {
        Object.keys(doc).forEach(field => {
          allFields.add(field);

          // Track field types
          const type = Array.isArray(doc[field]) ? 'array' : typeof doc[field];
          if (!fieldTypes[field]) {
            fieldTypes[field] = new Set();
          }
          fieldTypes[field].add(type);

          // Track field counts
          fieldCounts[field] = (fieldCounts[field] || 0) + 1;
        });
      });

      console.log('\nField analysis:');
      const fieldAnalysis = {};

      allFields.forEach(field => {
        fieldAnalysis[field] = {
          types: Array.from(fieldTypes[field]),
          presentInSamples: fieldCounts[field],
          percentPresent: Math.round((fieldCounts[field] / samples.length) * 100)
        };

        // Check for nested fields
        if (samples[0][field] && typeof samples[0][field] === 'object' && !Array.isArray(samples[0][field])) {
          fieldAnalysis[field].nestedFields = Object.keys(samples[0][field]);
        }

        // Check for array fields
        if (samples[0][field] && Array.isArray(samples[0][field]) && samples[0][field].length > 0) {
          fieldAnalysis[field].arrayElementType = typeof samples[0][field][0];

          if (typeof samples[0][field][0] === 'object' && samples[0][field][0] !== null) {
            fieldAnalysis[field].arrayElementFields = Object.keys(samples[0][field][0]);
          }
        }
      });

      console.log(JSON.stringify(fieldAnalysis, null, 2));

      // 4. Analyze potential relationships
      console.log('\nPotential relationships:');

      const relationshipFields = Array.from(allFields).filter(field =>
        field.endsWith('Id') ||
        field === '_id' ||
        field === 'playerId' ||
        (field === 'context' && fieldAnalysis[field].nestedFields &&
         fieldAnalysis[field].nestedFields.some(f => f.endsWith('Id')))
      );

      console.log(relationshipFields);

      // 5. Check for specific field values
      if (collectionName === 'events') {
        // Analyze event types
        const eventTypes = await collection.distinct('type');
        console.log('\nEvent types:', eventTypes);

        // Count events by type
        console.log('\nEvent counts by type:');
        for (const type of eventTypes) {
          const typeCount = await collection.countDocuments({ type });
          console.log(`${type}: ${typeCount}`);
        }

        // Check context field structure for different event types
        console.log('\nContext field structure by event type:');
        for (const type of eventTypes) {
          const sampleEvent = await collection.findOne({ type });
          if (sampleEvent && sampleEvent.context) {
            console.log(`${type} context fields:`, Object.keys(sampleEvent.context));
          }
        }
      }

      if (collectionName === 'questions') {
        // Check for choices field
        const hasChoices = samples.some(q => q.choices && Array.isArray(q.choices));
        console.log('\nQuestions have choices field:', hasChoices);

        if (hasChoices) {
          const sampleWithChoices = samples.find(q => q.choices && Array.isArray(q.choices));
          if (sampleWithChoices) {
            console.log('Sample choice structure:');
            console.log(JSON.stringify(sampleWithChoices.choices[0], null, 2));
          }
        }
      }

      if (collectionName === 'players') {
        // Check player identification fields
        console.log('\nPlayer identification fields:');
        const idFields = ['playerId', 'userId', 'email', 'name'].filter(f => allFields.has(f));
        console.log(idFields);
      }

      if (collectionName === 'leaderboards') {
        // Check score field
        const hasScore = samples.some(l => 'score' in l);
        console.log('\nLeaderboards have score field:', hasScore);

        if (hasScore) {
          // Get min and max scores
          const minScore = await collection.find().sort({ score: 1 }).limit(1).toArray();
          const maxScore = await collection.find().sort({ score: -1 }).limit(1).toArray();

          if (minScore.length > 0 && maxScore.length > 0) {
            console.log(`Score range: ${minScore[0].score} to ${maxScore[0].score}`);
          }
        }
      }

      // 6. Generate sample queries
      console.log('\nSample queries for this collection:');
      const queries = generateSampleQueries(collectionName, fieldAnalysis);
      console.log(JSON.stringify(queries, null, 2));

      // 7. Save analysis to file
      const analysis = {
        collectionName,
        count,
        fieldAnalysis,
        relationshipFields,
        samples,
        queries
      };

      // Add collection-specific analysis
      if (collectionName === 'events') {
        analysis.eventTypes = await collection.distinct('type');
      }

      fs.writeFileSync(`${outputDir}/${collectionName}_analysis.json`, JSON.stringify(analysis, null, 2));
      console.log(`Analysis saved to ${outputDir}/${collectionName}_analysis.json`);
    }

    // Generate a summary of all collections
    generateCollectionsSummary(outputDir, collections);

    // Close the connection
    mongoose.connection.close();
    console.log('\nConnection closed');
  } catch (err) {
    console.error('MongoDB connection error:', err);
  }
}

// Generate sample queries for a collection
function generateSampleQueries(collectionName, fieldAnalysis) {
  const queries = [];

  // Basic queries
  queries.push({
    description: `Find all ${collectionName}`,
    naturalLanguage: `Show me all ${collectionName}`,
    mongoQuery: `db.${collectionName}.find({})`
  });

  // Collection-specific queries
  switch (collectionName) {
    case 'items':
      if (fieldAnalysis.name) {
        queries.push({
          description: 'Find items by name',
          naturalLanguage: 'Find items with "key" in their name',
          mongoQuery: `db.items.find({ name: { $regex: "key", $options: "i" } })`
        });
      }

      queries.push({
        description: 'Count items collected by players',
        naturalLanguage: 'How many times has each item been collected?',
        mongoQuery: `db.events.aggregate([
  { $match: { type: "item" } },
  { $group: { _id: "$context.itemId", count: { $sum: 1 } } },
  { $lookup: { from: "items", localField: "_id", foreignField: "_id", as: "itemDetails" } },
  { $unwind: { path: "$itemDetails", preserveNullAndEmptyArrays: true } },
  { $project: { itemId: "$_id", itemName: "$itemDetails.name", count: 1, _id: 0 } },
  { $sort: { count: -1 } }
])`
      });
      break;

    case 'players':
      if (fieldAnalysis.name) {
        queries.push({
          description: 'Find players by name',
          naturalLanguage: 'Find players with "john" in their name',
          mongoQuery: `db.players.find({ name: { $regex: "john", $options: "i" } })`
        });
      }

      queries.push({
        description: 'Find all events for a specific player',
        naturalLanguage: 'Show me all events for player X',
        mongoQuery: `db.events.find({ playerId: "<player_id>" })`
      });

      queries.push({
        description: 'Count events by type for a player',
        naturalLanguage: 'How many events of each type does player X have?',
        mongoQuery: `db.events.aggregate([
  { $match: { playerId: "<player_id>" } },
  { $group: { _id: "$type", count: { $sum: 1 } } },
  { $sort: { count: -1 } }
])`
      });
      break;

    case 'questions':
      queries.push({
        description: 'Find questions by text',
        naturalLanguage: 'Find questions containing "history"',
        mongoQuery: `db.questions.find({ text: { $regex: "history", $options: "i" } })`
      });

      queries.push({
        description: 'Count how many times each question has been answered',
        naturalLanguage: 'How many times has each question been answered?',
        mongoQuery: `db.events.aggregate([
  { $match: { type: "question" } },
  { $group: { _id: "$context.questionId", count: { $sum: 1 } } },
  { $lookup: { from: "questions", localField: "_id", foreignField: "_id", as: "questionDetails" } },
  { $unwind: { path: "$questionDetails", preserveNullAndEmptyArrays: true } },
  { $project: { questionId: "$_id", questionText: "$questionDetails.text", count: 1, _id: 0 } },
  { $sort: { count: -1 } }
])`
      });
      break;

    case 'zones':
      if (fieldAnalysis.name) {
        queries.push({
          description: 'Find zones by name',
          naturalLanguage: 'Find zones with "forest" in their name',
          mongoQuery: `db.zones.find({ name: { $regex: "forest", $options: "i" } })`
        });
      }

      queries.push({
        description: 'Count zone entries',
        naturalLanguage: 'How many times has each zone been entered?',
        mongoQuery: `db.events.aggregate([
  { $match: { type: "zone" } },
  { $group: { _id: "$context.zoneId", count: { $sum: 1 } } },
  { $lookup: { from: "zones", localField: "_id", foreignField: "_id", as: "zoneDetails" } },
  { $unwind: { path: "$zoneDetails", preserveNullAndEmptyArrays: true } },
  { $project: { zoneId: "$_id", zoneName: "$zoneDetails.name", count: 1, _id: 0 } },
  { $sort: { count: -1 } }
])`
      });
      break;

    case 'leaderboards':
      queries.push({
        description: 'Find top players by score',
        naturalLanguage: 'Who are the top 10 players by score?',
        mongoQuery: `db.leaderboards.find().sort({ score: -1 }).limit(10)`
      });

      queries.push({
        description: 'Find leaderboard entries for a specific player',
        naturalLanguage: 'Show me the leaderboard entries for player X',
        mongoQuery: `db.leaderboards.find({ playerId: "<player_id>" })`
      });
      break;

    case 'events':
      queries.push({
        description: 'Find events by type',
        naturalLanguage: 'Show me all question events',
        mongoQuery: `db.events.find({ type: "question" })`
      });

      queries.push({
        description: 'Count events by type',
        naturalLanguage: 'How many events are there of each type?',
        mongoQuery: `db.events.aggregate([
  { $group: { _id: "$type", count: { $sum: 1 } } },
  { $sort: { count: -1 } }
])`
      });

      queries.push({
        description: 'Find events by time range',
        naturalLanguage: 'Show me events from January 2023',
        mongoQuery: `db.events.find({ time: { $gte: ISODate("2023-01-01"), $lte: ISODate("2023-01-31") } })`
      });
      break;
  }

  return queries;
}

// Generate a summary of all collections
function generateCollectionsSummary(outputDir, collections) {
  const summary = {
    collections: {},
    relationships: [],
    recommendedQueries: []
  };

  // Load analysis for each collection
  for (const collectionName of collections) {
    const analysisPath = `${outputDir}/${collectionName}_analysis.json`;
    if (fs.existsSync(analysisPath)) {
      const analysis = JSON.parse(fs.readFileSync(analysisPath, 'utf8'));

      // Add collection info
      summary.collections[collectionName] = {
        count: analysis.count,
        fields: Object.keys(analysis.fieldAnalysis || {}),
        relationshipFields: analysis.relationshipFields || []
      };

      // Add collection-specific info
      if (collectionName === 'events' && analysis.eventTypes) {
        summary.collections[collectionName].eventTypes = analysis.eventTypes;
      }
    }
  }

  // Define relationships between collections
  summary.relationships = [
    { from: 'events', fromField: 'playerId', to: 'players', toField: 'playerId', type: 'many-to-one' },
    { from: 'events', fromField: 'context.itemId', to: 'items', toField: '_id', type: 'many-to-one' },
    { from: 'events', fromField: 'context.questionId', to: 'questions', toField: '_id', type: 'many-to-one' },
    { from: 'events', fromField: 'context.zoneId', to: 'zones', toField: '_id', type: 'many-to-one' },
    { from: 'leaderboards', fromField: 'playerId', to: 'players', toField: 'playerId', type: 'many-to-one' }
  ];

  // Generate recommended complex queries
  summary.recommendedQueries = [
    {
      description: 'Player activity summary',
      naturalLanguage: 'Give me a summary of activities for each player',
      mongoQuery: `db.events.aggregate([
  { $group: {
    _id: "$playerId",
    totalEvents: { $sum: 1 },
    questionEvents: { $sum: { $cond: [{ $eq: ["$type", "question"] }, 1, 0] } },
    itemEvents: { $sum: { $cond: [{ $eq: ["$type", "item"] }, 1, 0] } },
    zoneEvents: { $sum: { $cond: [{ $eq: ["$type", "zone"] }, 1, 0] } }
  }},
  { $lookup: { from: "players", localField: "_id", foreignField: "playerId", as: "playerDetails" } },
  { $unwind: { path: "$playerDetails", preserveNullAndEmptyArrays: true } },
  { $project: {
    playerId: "$_id",
    playerName: "$playerDetails.name",
    totalEvents: 1,
    questionEvents: 1,
    itemEvents: 1,
    zoneEvents: 1,
    _id: 0
  }},
  { $sort: { totalEvents: -1 } }
])`
    },
    {
      description: 'Question difficulty analysis',
      naturalLanguage: 'Which questions are answered most frequently?',
      mongoQuery: `db.events.aggregate([
  { $match: { type: "question" } },
  { $group: {
    _id: "$context.questionId",
    timesAnswered: { $sum: 1 }
  }},
  { $lookup: { from: "questions", localField: "_id", foreignField: "_id", as: "questionDetails" } },
  { $unwind: { path: "$questionDetails", preserveNullAndEmptyArrays: true } },
  { $project: {
    questionId: "$_id",
    questionText: "$questionDetails.text",
    timesAnswered: 1,
    _id: 0
  }},
  { $sort: { timesAnswered: -1 } }
])`
    },
    {
      description: 'Player progression path',
      naturalLanguage: 'Show me the progression path for player X',
      mongoQuery: `db.events.aggregate([
  { $match: { playerId: "<player_id>" } },
  { $sort: { time: 1 } },
  { $project: {
    eventType: "$type",
    time: 1,
    details: {
      $switch: {
        branches: [
          { case: { $eq: ["$type", "question"] }, then: { $concat: ["Question: ", { $toString: "$context.questionId" }] } },
          { case: { $eq: ["$type", "item"] }, then: { $concat: ["Item: ", { $toString: "$context.itemId" }] } },
          { case: { $eq: ["$type", "zone"] }, then: { $concat: ["Zone: ", { $toString: "$context.zoneId" }] } }
        ],
        default: "Other"
      }
    }
  }}
])`
    },
    {
      description: 'Zone popularity by player count',
      naturalLanguage: 'Which zones are visited by the most unique players?',
      mongoQuery: `db.events.aggregate([
  { $match: { type: "zone" } },
  { $group: {
    _id: "$context.zoneId",
    uniquePlayers: { $addToSet: "$playerId" },
    totalVisits: { $sum: 1 }
  }},
  { $lookup: { from: "zones", localField: "_id", foreignField: "_id", as: "zoneDetails" } },
  { $unwind: { path: "$zoneDetails", preserveNullAndEmptyArrays: true } },
  { $project: {
    zoneId: "$_id",
    zoneName: "$zoneDetails.name",
    uniquePlayerCount: { $size: "$uniquePlayers" },
    totalVisits: 1,
    _id: 0
  }},
  { $sort: { uniquePlayerCount: -1 } }
])`
    },
    {
      description: 'Item collection timeline',
      naturalLanguage: 'Show me when items are collected throughout the game',
      mongoQuery: `db.events.aggregate([
  { $match: { type: "item" } },
  { $group: {
    _id: { $dateToString: { format: "%Y-%m-%d", date: "$time" } },
    itemsCollected: { $sum: 1 },
    uniqueItems: { $addToSet: "$context.itemId" }
  }},
  { $project: {
    date: "$_id",
    itemsCollected: 1,
    uniqueItemCount: { $size: "$uniqueItems" },
    _id: 0
  }},
  { $sort: { date: 1 } }
])`
    }
  ];

  // Save summary
  fs.writeFileSync(`${outputDir}/collections_summary.json`, JSON.stringify(summary, null, 2));
  console.log(`Collections summary saved to ${outputDir}/collections_summary.json`);
}

// Run the analysis
analyzeCollections();
