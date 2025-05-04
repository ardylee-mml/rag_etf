/**
 * Script to analyze MongoDB collections and generate comprehensive summaries
 * including schema, relationships, and example queries.
 */

const mongoose = require('mongoose');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/mmldb';

// Output directory for summaries
const SUMMARIES_DIR = path.join(__dirname, '../data/collection-summaries');

// Collections to analyze
const COLLECTIONS = [
  'events',
  'players',
  'items',
  'zones',
  'questions',
  'leaderboards'
];

// Sample size for analysis
const SAMPLE_SIZE = 500;

// Create output directory if it doesn't exist
async function ensureDirectoryExists(dir) {
  try {
    await fs.mkdir(dir, { recursive: true });
    console.log(`Directory created: ${dir}`);
  } catch (error) {
    if (error.code !== 'EEXIST') {
      throw error;
    }
  }
}

// Analyze a collection's schema
async function analyzeSchema(db, collectionName) {
  console.log(`Analyzing schema for collection: ${collectionName}`);

  const collection = db.collection(collectionName);
  const sampleDocs = await collection.find().limit(SAMPLE_SIZE).toArray();

  if (sampleDocs.length === 0) {
    console.log(`No documents found in collection: ${collectionName}`);
    return {
      fields: [],
      sampleCount: 0
    };
  }

  // Get collection stats
  const stats = await db.command({ collStats: collectionName });

  // Analyze field types and frequencies
  const fieldAnalysis = {};
  const idTypes = new Set();

  sampleDocs.forEach(doc => {
    // Track ID field types
    if (doc._id) {
      idTypes.add(typeof doc._id === 'object' ? doc._id.constructor.name : typeof doc._id);
    }

    // Analyze all fields
    analyzeObject(doc, fieldAnalysis);
  });

  // Convert field analysis to array format
  const fields = Object.entries(fieldAnalysis).map(([fieldPath, analysis]) => {
    return {
      path: fieldPath,
      types: Array.from(analysis.types),
      frequency: analysis.count / sampleDocs.length,
      sample: analysis.samples.slice(0, 5),
      isArray: analysis.isArray,
      nestedFields: analysis.nestedFields ? Object.keys(analysis.nestedFields) : []
    };
  });

  return {
    collectionName,
    documentCount: stats.count,
    sampleCount: sampleDocs.length,
    idType: Array.from(idTypes).join(' | '),
    fields,
    sampleDocuments: sampleDocs.slice(0, 3)
  };
}

// Recursively analyze object fields
function analyzeObject(obj, analysis, prefix = '') {
  for (const [key, value] of Object.entries(obj)) {
    if (key === '__v') continue; // Skip Mongoose version key

    const fieldPath = prefix ? `${prefix}.${key}` : key;

    if (!analysis[fieldPath]) {
      analysis[fieldPath] = {
        types: new Set(),
        count: 0,
        samples: [],
        isArray: false,
        nestedFields: {}
      };
    }

    const fieldAnalysis = analysis[fieldPath];
    fieldAnalysis.count++;

    if (Array.isArray(value)) {
      fieldAnalysis.isArray = true;
      fieldAnalysis.types.add('Array');

      // Analyze array elements if not empty
      if (value.length > 0) {
        // Check if array contains objects
        if (typeof value[0] === 'object' && value[0] !== null) {
          value.slice(0, 3).forEach((item, index) => {
            analyzeObject(item, fieldAnalysis.nestedFields, `${fieldPath}[${index}]`);
          });
        } else {
          // For primitive arrays, store element type
          fieldAnalysis.types.add(`Array<${typeof value[0]}>`);
        }
      }

      // Store sample of array
      if (fieldAnalysis.samples.length < 5) {
        fieldAnalysis.samples.push(value.slice(0, 3));
      }
    } else if (value !== null && typeof value === 'object') {
      fieldAnalysis.types.add(value.constructor.name || 'Object');

      // Store sample
      if (fieldAnalysis.samples.length < 5) {
        fieldAnalysis.samples.push(value);
      }

      // Recursively analyze nested object
      analyzeObject(value, analysis, fieldPath);
    } else {
      fieldAnalysis.types.add(typeof value);

      // Store sample value
      if (fieldAnalysis.samples.length < 5) {
        fieldAnalysis.samples.push(value);
      }
    }
  }
}

// Identify potential relationships between collections
async function identifyRelationships(db, schemas) {
  console.log('Identifying relationships between collections...');

  const relationships = {};

  for (const sourceCollection of COLLECTIONS) {
    relationships[sourceCollection] = [];

    const sourceSchema = schemas[sourceCollection];
    if (!sourceSchema) continue;

    // Look for fields that might reference other collections
    for (const field of sourceSchema.fields) {
      // Skip _id field
      if (field.path === '_id') continue;

      // Check if field name suggests a relationship
      const potentialTargets = COLLECTIONS.filter(coll => {
        const singularName = coll.endsWith('s') ? coll.slice(0, -1) : coll;
        return field.path.toLowerCase().includes(singularName.toLowerCase() + 'id') ||
               field.path.toLowerCase() === singularName.toLowerCase() + '_id' ||
               field.path.toLowerCase() === singularName.toLowerCase();
      });

      for (const targetCollection of potentialTargets) {
        if (targetCollection === sourceCollection) continue;

        // Check if field values match _id values in target collection
        const targetSchema = schemas[targetCollection];
        if (!targetSchema) continue;

        // Sample some values from source collection for this field
        const sourceCollectionObj = db.collection(sourceCollection);
        const fieldPath = field.path;
        const sampleValues = await sourceCollectionObj.find(
          { [fieldPath]: { $exists: true, $ne: null } },
          { projection: { [fieldPath]: 1 } }
        ).limit(50).toArray();

        if (sampleValues.length === 0) continue;

        // Extract field values
        const fieldValues = sampleValues.map(doc => {
          const parts = fieldPath.split('.');
          let value = doc;
          for (const part of parts) {
            if (!value) return null;
            value = value[part];
          }
          return value;
        }).filter(v => v !== null);

        if (fieldValues.length === 0) continue;

        // Check if these values exist in target collection
        const targetColl = db.collection(targetCollection);
        const matchCount = await targetColl.countDocuments({
          _id: { $in: fieldValues }
        });

        if (matchCount > 0) {
          relationships[sourceCollection].push({
            sourceField: fieldPath,
            targetCollection,
            targetField: '_id',
            matchCount,
            confidence: matchCount / fieldValues.length
          });
          continue;
        }

        // Check if values match any other field in target collection
        for (const targetField of targetSchema.fields) {
          if (targetField.path === '_id') continue;

          const matchCount = await targetColl.countDocuments({
            [targetField.path]: { $in: fieldValues }
          });

          if (matchCount > 0) {
            relationships[sourceCollection].push({
              sourceField: fieldPath,
              targetCollection,
              targetField: targetField.path,
              matchCount,
              confidence: matchCount / fieldValues.length
            });
            break;
          }
        }
      }
    }
  }

  return relationships;
}

// Generate example queries for each collection
function generateExampleQueries(collectionName, schema, relationships) {
  console.log(`Generating example queries for collection: ${collectionName}`);

  const queries = [];

  // Common query patterns based on collection type
  switch (collectionName) {
    case 'events':
      queries.push({
        description: "Count events by type",
        question: "How many events are there of each type?",
        pipeline: [
          { $group: { _id: "$type", count: { $sum: 1 } } },
          { $sort: { count: -1 } }
        ]
      });

      queries.push({
        description: "Find players with most activity",
        question: "Which players have the most events?",
        pipeline: [
          { $group: { _id: "$playerId", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 10 },
          { $lookup: { from: "players", localField: "_id", foreignField: "playerId", as: "playerDetails" } },
          { $unwind: { path: "$playerDetails", preserveNullAndEmptyArrays: true } },
          { $project: { playerId: "$_id", playerName: "$playerDetails.name", eventCount: "$count", _id: 0 } }
        ]
      });

      queries.push({
        description: "Count players who played more than X times",
        question: "How many players played more than 5 times?",
        pipeline: [
          { $group: { _id: "$playerId", count: { $sum: 1 } } },
          { $match: { count: { $gt: 5 } } },
          { $count: "totalPlayers" }
        ]
      });

      queries.push({
        description: "Most answered questions",
        question: "What are the most answered questions?",
        pipeline: [
          { $match: { type: "question" } },
          { $group: { _id: "$context.questionId", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 10 },
          { $lookup: { from: "questions", localField: "_id", foreignField: "_id", as: "questionDetails" } },
          { $unwind: { path: "$questionDetails", preserveNullAndEmptyArrays: true } },
          { $project: { questionId: "$_id", questionText: "$questionDetails.text", count: 1, _id: 0 } }
        ]
      });
      break;

    case 'players':
      queries.push({
        description: "Count total players",
        question: "How many players are there in total?",
        pipeline: [
          { $count: "totalPlayers" }
        ]
      });

      queries.push({
        description: "Find players by name",
        question: "Find players with name containing 'Smith'",
        pipeline: [
          { $match: { name: { $regex: "Smith", $options: "i" } } },
          { $project: { _id: 0, playerId: 1, name: 1, email: 1 } }
        ]
      });
      break;

    case 'questions':
      queries.push({
        description: "Count questions by difficulty",
        question: "How many questions are there of each difficulty level?",
        pipeline: [
          { $group: { _id: "$difficulty", count: { $sum: 1 } } },
          { $sort: { count: -1 } }
        ]
      });

      queries.push({
        description: "Find questions with most wrong answers",
        question: "Which questions have the most wrong answers?",
        pipeline: [
          { $lookup: {
            from: "events",
            let: { questionId: "$_id" },
            pipeline: [
              { $match: {
                $expr: {
                  $and: [
                    { $eq: ["$type", "question"] },
                    { $eq: ["$context.questionId", "$$questionId"] }
                  ]
                }
              }},
              { $lookup: {
                from: "questions",
                localField: "context.questionId",
                foreignField: "_id",
                as: "questionData"
              }},
              { $unwind: "$questionData" },
              { $match: {
                $expr: {
                  $ne: ["$context.choiceId", {
                    $arrayElemAt: [
                      { $filter: {
                        input: "$questionData.choices",
                        as: "choice",
                        cond: { $ifNull: ["$$choice.notes", false] }
                      }},
                      0
                    ]._id
                  }]
                }
              }}
            ],
            as: "wrongAnswers"
          }},
          { $project: {
            _id: 1,
            text: 1,
            wrongAnswerCount: { $size: "$wrongAnswers" }
          }},
          { $sort: { wrongAnswerCount: -1 } },
          { $limit: 10 }
        ]
      });
      break;

    case 'leaderboards':
      queries.push({
        description: "Find top players by score",
        question: "Who are the top 10 players by score?",
        pipeline: [
          { $sort: { score: -1 } },
          { $limit: 10 },
          { $project: { _id: 0, playerName: 1, score: 1, level: 1 } }
        ]
      });

      queries.push({
        description: "Calculate average player score",
        question: "What is the average player score?",
        pipeline: [
          { $group: { _id: null, averageScore: { $avg: "$score" } } },
          { $project: { _id: 0, averageScore: 1 } }
        ]
      });

      queries.push({
        description: "Get score statistics",
        question: "What are the minimum, maximum, and average scores?",
        pipeline: [
          { $group: {
            _id: null,
            minScore: { $min: "$score" },
            maxScore: { $max: "$score" },
            avgScore: { $avg: "$score" },
            totalPlayers: { $sum: 1 }
          }},
          { $project: { _id: 0 } }
        ]
      });

      queries.push({
        description: "Group players by level",
        question: "How many players are at each level?",
        pipeline: [
          { $group: { _id: "$level", count: { $sum: 1 } } },
          { $sort: { _id: 1 } },
          { $project: { level: "$_id", count: 1, _id: 0 } }
        ]
      });
      break;

    case 'items':
      queries.push({
        description: "Find most interacted items",
        question: "Which items have been interacted with the most?",
        pipeline: [
          { $lookup: {
            from: "events",
            localField: "_id",
            foreignField: "context.itemId",
            as: "interactions"
          }},
          { $project: {
            _id: 1,
            name: 1,
            interactionCount: { $size: "$interactions" }
          }},
          { $sort: { interactionCount: -1 } },
          { $limit: 10 }
        ]
      });
      break;

    case 'zones':
      queries.push({
        description: "Find most visited zones",
        question: "Which zones have been visited the most?",
        pipeline: [
          { $lookup: {
            from: "events",
            localField: "_id",
            foreignField: "context.zoneId",
            as: "visits"
          }},
          { $project: {
            _id: 1,
            name: 1,
            visitCount: { $size: "$visits" }
          }},
          { $sort: { visitCount: -1 } },
          { $limit: 10 }
        ]
      });
      break;
  }

  // Add generic queries for all collections
  queries.push({
    description: "Count total documents",
    question: `How many documents are in the ${collectionName} collection?`,
    pipeline: [
      { $count: "total" }
    ]
  });

  return queries;
}

// Generate a comprehensive summary for each collection
function generateSummary(collectionName, schema, relationships, queries) {
  console.log(`Generating summary for collection: ${collectionName}`);

  // Get relationships where this collection is the target
  const incomingRelationships = [];
  for (const [sourceColl, rels] of Object.entries(relationships)) {
    if (sourceColl === collectionName) continue;

    for (const rel of rels) {
      if (rel.targetCollection === collectionName) {
        incomingRelationships.push({
          sourceCollection: sourceColl,
          sourceField: rel.sourceField,
          targetField: rel.targetField,
          confidence: rel.confidence
        });
      }
    }
  }

  // Create summary object
  return {
    collectionName,
    description: getCollectionDescription(collectionName),
    documentCount: schema.documentCount,
    idType: schema.idType,
    keyFields: getKeyFields(collectionName, schema),
    fields: schema.fields.map(field => ({
      path: field.path,
      types: field.types,
      frequency: field.frequency,
      isArray: field.isArray,
      description: getFieldDescription(collectionName, field.path)
    })),
    outgoingRelationships: relationships[collectionName] || [],
    incomingRelationships,
    sampleDocuments: schema.sampleDocuments,
    exampleQueries: queries
  };
}

// Get collection description
function getCollectionDescription(collectionName) {
  const descriptions = {
    events: "Contains player activity events such as logins, question answers, item interactions, and zone visits.",
    players: "Contains player information including IDs, names, and other profile details.",
    items: "Contains information about game items that players can interact with.",
    zones: "Contains information about game zones or areas that players can visit.",
    questions: "Contains questions that players can answer, including choices and correct answers.",
    leaderboards: "Contains player scores, levels, and rankings."
  };

  return descriptions[collectionName] || `Collection of ${collectionName}`;
}

// Get field description
function getFieldDescription(collectionName, fieldPath) {
  // Define known field descriptions
  const fieldDescriptions = {
    'events._id': "Unique identifier for the event",
    'events.playerId': "ID of the player who triggered the event",
    'events.type': "Type of event (signin, question, item, zone)",
    'events.time': "Timestamp when the event occurred",
    'events.context': "Additional context data specific to the event type",
    'events.context.questionId': "ID of the question being answered (for question events)",
    'events.context.choiceId': "ID of the selected answer choice (for question events)",
    'events.context.itemId': "ID of the item being interacted with (for item events)",
    'events.context.zoneId': "ID of the zone being visited (for zone events)",

    'players._id': "Unique identifier for the player in MongoDB",
    'players.playerId': "Business identifier for the player",
    'players.name': "Player's display name",
    'players.email': "Player's email address",

    'questions._id': "Unique identifier for the question",
    'questions.text': "The question text",
    'questions.choices': "Array of possible answer choices",
    'questions.choices._id': "Unique identifier for the choice",
    'questions.choices.text': "Text of the answer choice",
    'questions.choices.notes': "Present only on correct answers",
    'questions.userId': "ID of the user who created the question",

    'leaderboards._id': "Unique identifier for the leaderboard entry",
    'leaderboards.playerId': "ID of the player",
    'leaderboards.playerName': "Name of the player",
    'leaderboards.score': "Player's score",
    'leaderboards.level': "Player's current level",
    'leaderboards.lastUpdated': "Timestamp of the last update"
  };

  const key = `${collectionName}.${fieldPath}`;
  return fieldDescriptions[key] || null;
}

// Get key fields for a collection
function getKeyFields(collectionName, schema) {
  const keyFields = {
    events: ['_id', 'playerId', 'type', 'time'],
    players: ['_id', 'playerId', 'name'],
    items: ['_id', 'name'],
    zones: ['_id', 'name'],
    questions: ['_id', 'text', 'choices'],
    leaderboards: ['_id', 'playerId', 'playerName', 'score']
  };

  return keyFields[collectionName] || ['_id'];
}

// Main function
async function main() {
  try {
    console.log('Starting collection analysis...');

    // Ensure output directory exists
    await ensureDirectoryExists(SUMMARIES_DIR);

    // Connect to MongoDB
    console.log(`Connecting to MongoDB: ${MONGODB_URI}`);
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;

    // Analyze each collection
    const schemas = {};
    for (const collectionName of COLLECTIONS) {
      schemas[collectionName] = await analyzeSchema(db, collectionName);
    }

    // Identify relationships
    const relationships = await identifyRelationships(db, schemas);

    // Generate summaries for each collection
    for (const collectionName of COLLECTIONS) {
      const schema = schemas[collectionName];
      if (!schema || schema.sampleCount === 0) {
        console.log(`Skipping empty collection: ${collectionName}`);
        continue;
      }

      // Generate example queries
      const queries = generateExampleQueries(collectionName, schema, relationships);

      // Generate summary
      const summary = generateSummary(collectionName, schema, relationships, queries);

      // Write summary to file
      const outputPath = path.join(SUMMARIES_DIR, `${collectionName}-summary.json`);
      await fs.writeFile(outputPath, JSON.stringify(summary, null, 2));
      console.log(`Summary written to: ${outputPath}`);
    }

    // Generate a combined summary file
    const combinedSummary = {
      collections: COLLECTIONS.map(name => ({
        name,
        description: getCollectionDescription(name),
        documentCount: schemas[name]?.documentCount || 0
      })),
      relationships: relationships
    };

    const combinedPath = path.join(SUMMARIES_DIR, 'combined-summary.json');
    await fs.writeFile(combinedPath, JSON.stringify(combinedSummary, null, 2));
    console.log(`Combined summary written to: ${combinedPath}`);

    console.log('Analysis complete!');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Close MongoDB connection
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
  }
}

// Run the script
main();
