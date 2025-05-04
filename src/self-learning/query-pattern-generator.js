/**
 * Query Pattern Generator Module
 *
 * Generates MongoDB query patterns based on schema information and relationships.
 * These patterns serve as templates for answering different types of questions.
 */

/**
 * Generates query patterns based on schema information and relationships
 * @param {Object} schemaInfo Schema information from the schema analyzer
 * @param {Array} relationships Discovered relationships between collections
 * @returns {Array} Generated query patterns
 */
function generateQueryPatterns(schemaInfo, relationships) {
  const patterns = [];

  console.log('Generating query patterns...');

  // Generate basic patterns for each collection
  for (const collection in schemaInfo) {
    if (!schemaInfo[collection].fields) continue;

    console.log(`Generating patterns for collection: ${collection}`);

    // Basic CRUD patterns
    patterns.push({
      id: `find_all_${collection}`,
      type: 'find',
      collection,
      description: `Find all ${collection}`,
      template: `db.${collection}.find({})`,
      mongoQuery: { collection, operation: 'find', query: {} },
      complexity: 'basic',
      category: 'retrieval'
    });

    // Find by ID pattern
    patterns.push({
      id: `find_${collection}_by_id`,
      type: 'find',
      collection,
      description: `Find ${collection} by ID`,
      template: `db.${collection}.find({ _id: "<id_value>" })`,
      mongoQuery: {
        collection,
        operation: 'find',
        query: { _id: "<id_value>" },
        parameters: [{ name: "id_value", description: `ID of the ${collection} document` }]
      },
      complexity: 'basic',
      category: 'retrieval'
    });

    // Count pattern
    patterns.push({
      id: `count_${collection}`,
      type: 'aggregate',
      collection,
      description: `Count ${collection}`,
      template: `db.${collection}.countDocuments({})`,
      mongoQuery: { collection, operation: 'countDocuments', query: {} },
      complexity: 'basic',
      category: 'analytics'
    });

    // Generate field-specific patterns
    const fields = schemaInfo[collection].fields;
    for (const fieldName in fields) {
      const field = fields[fieldName];

      // Skip _id field as we already have a pattern for it
      if (fieldName === '_id') continue;

      // Find by field pattern
      if (field.examples && field.examples.length > 0) {
        const example = field.examples[0];
        const exampleValue = typeof example === 'object' ?
          (example?._bsontype ? example.toString() : JSON.stringify(example)) :
          example;

        patterns.push({
          id: `find_${collection}_by_${fieldName.replace(/\./g, '_')}`,
          type: 'find',
          collection,
          description: `Find ${collection} by ${fieldName}`,
          template: `db.${collection}.find({ ${fieldName}: ${JSON.stringify(example)} })`,
          mongoQuery: {
            collection,
            operation: 'find',
            query: { [fieldName]: "<field_value>" },
            parameters: [{
              name: "field_value",
              description: `Value of ${fieldName}`,
              example: exampleValue
            }]
          },
          complexity: 'basic',
          category: 'retrieval',
          fieldInfo: {
            name: fieldName,
            type: field.type
          }
        });
      }

      // Aggregation patterns for numeric fields
      if (field.type === 'number') {
        patterns.push({
          id: `avg_${collection}_${fieldName.replace(/\./g, '_')}`,
          type: 'aggregate',
          collection,
          description: `Calculate average ${fieldName} in ${collection}`,
          template: `db.${collection}.aggregate([
  { $match: { ${fieldName}: { $exists: true, $ne: null } } },
  { $group: { _id: null, average: { $avg: "$${fieldName}" } } }
])`,
          mongoQuery: {
            collection,
            operation: 'aggregate',
            pipeline: [
              { $match: { [fieldName]: { $exists: true, $ne: null } } },
              { $group: { _id: null, average: { $avg: `$${fieldName}` } } }
            ]
          },
          complexity: 'intermediate',
          category: 'analytics',
          fieldInfo: {
            name: fieldName,
            type: field.type
          }
        });

        patterns.push({
          id: `sum_${collection}_${fieldName.replace(/\./g, '_')}`,
          type: 'aggregate',
          collection,
          description: `Calculate sum of ${fieldName} in ${collection}`,
          template: `db.${collection}.aggregate([
  { $match: { ${fieldName}: { $exists: true, $ne: null } } },
  { $group: { _id: null, total: { $sum: "$${fieldName}" } } }
])`,
          mongoQuery: {
            collection,
            operation: 'aggregate',
            pipeline: [
              { $match: { [fieldName]: { $exists: true, $ne: null } } },
              { $group: { _id: null, total: { $sum: `$${fieldName}` } } }
            ]
          },
          complexity: 'intermediate',
          category: 'analytics',
          fieldInfo: {
            name: fieldName,
            type: field.type
          }
        });

        patterns.push({
          id: `min_max_${collection}_${fieldName.replace(/\./g, '_')}`,
          type: 'aggregate',
          collection,
          description: `Find minimum and maximum ${fieldName} in ${collection}`,
          template: `db.${collection}.aggregate([
  { $match: { ${fieldName}: { $exists: true, $ne: null } } },
  { $group: {
      _id: null,
      min: { $min: "$${fieldName}" },
      max: { $max: "$${fieldName}" }
    }
  }
])`,
          mongoQuery: {
            collection,
            operation: 'aggregate',
            pipeline: [
              { $match: { [fieldName]: { $exists: true, $ne: null } } },
              { $group: {
                _id: null,
                min: { $min: `$${fieldName}` },
                max: { $max: `$${fieldName}` }
              }}
            ]
          },
          complexity: 'intermediate',
          category: 'analytics',
          fieldInfo: {
            name: fieldName,
            type: field.type
          }
        });
      }

      // Date-based patterns for date fields
      if (field.type === 'date') {
        patterns.push({
          id: `group_by_date_${collection}_${fieldName.replace(/\./g, '_')}`,
          type: 'aggregate',
          collection,
          description: `Group ${collection} by ${fieldName} date`,
          template: `db.${collection}.aggregate([
  { $match: { ${fieldName}: { $exists: true, $ne: null } } },
  { $group: {
      _id: { $dateToString: { format: "%Y-%m-%d", date: "$${fieldName}" } },
      count: { $sum: 1 }
    }
  },
  { $sort: { _id: 1 } }
])`,
          mongoQuery: {
            collection,
            operation: 'aggregate',
            pipeline: [
              { $match: { [fieldName]: { $exists: true, $ne: null } } },
              { $group: {
                _id: { $dateToString: { format: "%Y-%m-%d", date: `$${fieldName}` } },
                count: { $sum: 1 }
              }},
              { $sort: { _id: 1 } }
            ]
          },
          complexity: 'intermediate',
          category: 'analytics',
          fieldInfo: {
            name: fieldName,
            type: field.type
          }
        });
      }
    }
  }

  // Generate patterns for each relationship
  for (const relationship of relationships) {
    // Skip multi-level relationships - we'll handle them separately
    if (relationship.type === 'multi-level') {
      continue;
    }

    // Check if the relationship has valid source and target
    if (!relationship.source || !relationship.target) {
      console.log('Skipping invalid relationship:', relationship);
      continue;
    }

    const sourceCollection = relationship.source.collection;
    const sourceField = relationship.source.field;
    const targetCollection = relationship.target.collection;
    const targetField = relationship.target.field;

    console.log(`Generating patterns for relationship: ${sourceCollection}.${sourceField} -> ${targetCollection}.${targetField}`);

    // Basic lookup pattern
    // Check if this is a players-events or events-players relationship
    // These need special handling due to the large number of documents
    if ((sourceCollection === 'players' && targetCollection === 'events') ||
        (sourceCollection === 'events' && targetCollection === 'players')) {

      // For players-events, use a sample-based approach
      if (sourceCollection === 'players') {
        patterns.push({
          id: `lookup_${sourceCollection}_${targetCollection}`,
          type: 'lookup',
          collections: [sourceCollection, targetCollection],
          description: `Find a sample of ${sourceCollection} with their related ${targetCollection}`,
          template: `db.${sourceCollection}.aggregate([
  { $sample: { size: 20 } },
  { $lookup: {
      from: "${targetCollection}",
      let: { playerId: "$${sourceField}" },
      pipeline: [
        { $match: { $expr: { $eq: ["$${targetField}", "$$playerId"] } } },
        { $limit: 100 }
      ],
      as: "related_${targetCollection}"
    }
  },
  { $limit: 20 }
])`,
          mongoQuery: {
            collection: sourceCollection,
            operation: 'aggregate',
            pipeline: [
              { $sample: { size: 20 } },
              { $lookup: {
                from: targetCollection,
                let: { playerId: `$${sourceField}` },
                pipeline: [
                  { $match: { $expr: { $eq: [`$${targetField}`, "$$playerId"] } } },
                  { $limit: 100 }
                ],
                as: `related_${targetCollection}`
              }},
              { $limit: 20 }
            ]
          },
          complexity: 'intermediate',
          category: 'relationship',
          relationshipInfo: {
            source: {
              collection: sourceCollection,
              field: sourceField
            },
            target: {
              collection: targetCollection,
              field: targetField
            }
          },
          optimized: true
        });
      } else {
        // For events-players, use a sample-based approach
        patterns.push({
          id: `lookup_${sourceCollection}_${targetCollection}`,
          type: 'lookup',
          collections: [sourceCollection, targetCollection],
          description: `Find a sample of ${sourceCollection} with their related ${targetCollection}`,
          template: `db.${sourceCollection}.aggregate([
  { $sample: { size: 100 } },
  { $lookup: {
      from: "${targetCollection}",
      localField: "${sourceField}",
      foreignField: "${targetField}",
      as: "related_${targetCollection}"
    }
  },
  { $limit: 100 }
])`,
          mongoQuery: {
            collection: sourceCollection,
            operation: 'aggregate',
            pipeline: [
              { $sample: { size: 100 } },
              { $lookup: {
                from: targetCollection,
                localField: sourceField,
                foreignField: targetField,
                as: `related_${targetCollection}`
              }},
              { $limit: 100 }
            ]
          },
          complexity: 'intermediate',
          category: 'relationship',
          relationshipInfo: {
            source: {
              collection: sourceCollection,
              field: sourceField
            },
            target: {
              collection: targetCollection,
              field: targetField
            }
          },
          optimized: true
        });
      }
    } else {
      // For other relationships, use the standard lookup pattern
      patterns.push({
        id: `lookup_${sourceCollection}_${targetCollection}`,
        type: 'lookup',
        collections: [sourceCollection, targetCollection],
        description: `Find ${sourceCollection} with their related ${targetCollection}`,
        template: `db.${sourceCollection}.aggregate([
  { $lookup: {
      from: "${targetCollection}",
      localField: "${sourceField}",
      foreignField: "${targetField}",
      as: "related_${targetCollection}"
    }
  },
  { $limit: 100 }
])`,
        mongoQuery: {
          collection: sourceCollection,
          operation: 'aggregate',
          pipeline: [
            { $lookup: {
              from: targetCollection,
              localField: sourceField,
              foreignField: targetField,
              as: `related_${targetCollection}`
            }},
            { $limit: 100 }
          ]
        },
        complexity: 'intermediate',
        category: 'relationship',
        relationshipInfo: {
          source: {
            collection: sourceCollection,
            field: sourceField
          },
          target: {
            collection: targetCollection,
            field: targetField
          }
        }
      });
    }

    // Count related documents pattern
    // Check if this is a players-events or events-players relationship
    if ((sourceCollection === 'players' && targetCollection === 'events') ||
        (sourceCollection === 'events' && targetCollection === 'players')) {

      // For players-events, use a sample-based approach
      if (sourceCollection === 'players') {
        patterns.push({
          id: `count_related_${sourceCollection}_${targetCollection}`,
          type: 'lookup',
          collections: [sourceCollection, targetCollection],
          description: `Count ${targetCollection} related to a sample of ${sourceCollection}`,
          template: `db.${sourceCollection}.aggregate([
  { $sample: { size: 20 } },
  { $lookup: {
      from: "${targetCollection}",
      let: { playerId: "$${sourceField}" },
      pipeline: [
        { $match: { $expr: { $eq: ["$${targetField}", "$$playerId"] } } },
        { $limit: 1000 }
      ],
      as: "related_${targetCollection}"
    }
  },
  { $project: {
      _id: 1,
      ${sourceField}: 1,
      related_count: { $size: "$related_${targetCollection}" },
      note: { $literal: "Count may be limited to 1000 events per player" }
    }
  },
  { $sort: { related_count: -1 } },
  { $limit: 20 }
])`,
          mongoQuery: {
            collection: sourceCollection,
            operation: 'aggregate',
            pipeline: [
              { $sample: { size: 20 } },
              { $lookup: {
                from: targetCollection,
                let: { playerId: `$${sourceField}` },
                pipeline: [
                  { $match: { $expr: { $eq: [`$${targetField}`, "$$playerId"] } } },
                  { $limit: 1000 }
                ],
                as: `related_${targetCollection}`
              }},
              { $project: {
                _id: 1,
                [sourceField]: 1,
                related_count: { $size: `$related_${targetCollection}` },
                note: { $literal: "Count may be limited to 1000 events per player" }
              }},
              { $sort: { related_count: -1 } },
              { $limit: 20 }
            ]
          },
          complexity: 'intermediate',
          category: 'relationship',
          relationshipInfo: {
            source: {
              collection: sourceCollection,
              field: sourceField
            },
            target: {
              collection: targetCollection,
              field: targetField
            }
          },
          optimized: true
        });
      } else {
        // For events-players, use a standard approach (should be manageable)
        patterns.push({
          id: `count_related_${sourceCollection}_${targetCollection}`,
          type: 'lookup',
          collections: [sourceCollection, targetCollection],
          description: `Count ${targetCollection} related to a sample of ${sourceCollection}`,
          template: `db.${sourceCollection}.aggregate([
  { $sample: { size: 100 } },
  { $lookup: {
      from: "${targetCollection}",
      localField: "${sourceField}",
      foreignField: "${targetField}",
      as: "related_${targetCollection}"
    }
  },
  { $project: {
      _id: 1,
      ${sourceField}: 1,
      related_count: { $size: "$related_${targetCollection}" }
    }
  },
  { $sort: { related_count: -1 } },
  { $limit: 100 }
])`,
          mongoQuery: {
            collection: sourceCollection,
            operation: 'aggregate',
            pipeline: [
              { $sample: { size: 100 } },
              { $lookup: {
                from: targetCollection,
                localField: sourceField,
                foreignField: targetField,
                as: `related_${targetCollection}`
              }},
              { $project: {
                _id: 1,
                [sourceField]: 1,
                related_count: { $size: `$related_${targetCollection}` }
              }},
              { $sort: { related_count: -1 } },
              { $limit: 100 }
            ]
          },
          complexity: 'intermediate',
          category: 'relationship',
          relationshipInfo: {
            source: {
              collection: sourceCollection,
              field: sourceField
            },
            target: {
              collection: targetCollection,
              field: targetField
            }
          },
          optimized: true
        });
      }
    } else {
      // For other relationships, use the standard pattern
      patterns.push({
        id: `count_related_${sourceCollection}_${targetCollection}`,
        type: 'lookup',
        collections: [sourceCollection, targetCollection],
        description: `Count ${targetCollection} related to each ${sourceCollection}`,
        template: `db.${sourceCollection}.aggregate([
  { $lookup: {
      from: "${targetCollection}",
      localField: "${sourceField}",
      foreignField: "${targetField}",
      as: "related_${targetCollection}"
    }
  },
  { $project: {
      _id: 1,
      ${sourceField}: 1,
      related_count: { $size: "$related_${targetCollection}" }
    }
  },
  { $sort: { related_count: -1 } },
  { $limit: 100 }
])`,
        mongoQuery: {
          collection: sourceCollection,
          operation: 'aggregate',
          pipeline: [
            { $lookup: {
              from: targetCollection,
              localField: sourceField,
              foreignField: targetField,
              as: `related_${targetCollection}`
            }},
            { $project: {
              _id: 1,
              [sourceField]: 1,
              related_count: { $size: `$related_${targetCollection}` }
            }},
            { $sort: { related_count: -1 } },
            { $limit: 100 }
          ]
        },
        complexity: 'intermediate',
        category: 'relationship',
        relationshipInfo: {
          source: {
            collection: sourceCollection,
            field: sourceField
          },
          target: {
            collection: targetCollection,
            field: targetField
          }
        }
      });
    }
  }

  // Special patterns for specific collection combinations
  if (schemaInfo.events && schemaInfo.questions) {
    console.log('Generating special patterns for events-questions relationship');

    // Average attempts per question pattern
    patterns.push({
      id: 'avg_attempts_per_question',
      type: 'complex',
      collections: ['events', 'questions'],
      description: 'Calculate average attempts per question',
      template: `db.events.aggregate([
  { $match: { type: "question" } },
  { $group: {
      _id: {
          playerId: "$playerId",
          questionId: "$context.questionId"
      },
      count: { $sum: 1 }
    }
  },
  { $group: {
      _id: "$_id.questionId",
      avgAttempts: { $avg: "$count" }
    }
  },
  { $project: {
      questionId: "$_id",
      avgAttempts: 1,
      _id: 0
    }
  },
  { $lookup: {
      from: "questions",
      let: { qid: { $toLower: "$questionId" } },
      pipeline: [
        { $addFields: { idLower: { $toLower: { $toString: "$_id" } } } },
        { $match: { $expr: { $eq: ["$idLower", "$$qid"] } } }
      ],
      as: "questionDetails"
    }
  },
  { $project: {
      questionId: 1,
      avgAttempts: 1,
      questionText: {
        $ifNull: [
          { $arrayElemAt: ["$questionDetails.text", 0] },
          "Question text not available"
        ]
      }
    }
  },
  { $sort: { avgAttempts: -1 } }
])`,
      mongoQuery: {
        collection: 'events',
        operation: 'aggregate',
        pipeline: [
          { $match: { type: "question" } },
          { $group: {
              _id: {
                  playerId: "$playerId",
                  questionId: "$context.questionId"
              },
              count: { $sum: 1 }
            }
          },
          { $group: {
              _id: "$_id.questionId",
              avgAttempts: { $avg: "$count" }
            }
          },
          { $project: {
              questionId: "$_id",
              avgAttempts: 1,
              _id: 0
            }
          },
          { $lookup: {
              from: "questions",
              let: { qid: { $toLower: "$questionId" } },
              pipeline: [
                { $addFields: { idLower: { $toLower: { $toString: "$_id" } } } },
                { $match: { $expr: { $eq: ["$idLower", "$$qid"] } } }
              ],
              as: "questionDetails"
            }
          },
          { $project: {
              questionId: 1,
              avgAttempts: 1,
              questionText: {
                $ifNull: [
                  { $arrayElemAt: ["$questionDetails.text", 0] },
                  "Question text not available"
                ]
              }
            }
          },
          { $sort: { avgAttempts: -1 } }
        ]
      },
      complexity: 'advanced',
      category: 'analytics',
      relationshipInfo: {
        source: {
          collection: 'events',
          field: 'context.questionId'
        },
        target: {
          collection: 'questions',
          field: '_id'
        }
      }
    });

    // Correct answer rate per question pattern
    patterns.push({
      id: 'correct_answer_rate_per_question',
      type: 'complex',
      collections: ['events', 'questions'],
      description: 'Calculate correct answer rate per question',
      template: `db.events.aggregate([
  { $match: { type: "question" } },
  { $group: {
      _id: "$context.questionId",
      totalAttempts: { $sum: 1 },
      correctAttempts: {
        $sum: { $cond: [{ $eq: ["$correct", true] }, 1, 0] }
      }
    }
  },
  { $project: {
      questionId: "$_id",
      totalAttempts: 1,
      correctAttempts: 1,
      correctRate: {
        $divide: ["$correctAttempts", "$totalAttempts"]
      },
      _id: 0
    }
  },
  { $lookup: {
      from: "questions",
      let: { qid: { $toLower: "$questionId" } },
      pipeline: [
        { $addFields: { idLower: { $toLower: { $toString: "$_id" } } } },
        { $match: { $expr: { $eq: ["$idLower", "$$qid"] } } }
      ],
      as: "questionDetails"
    }
  },
  { $project: {
      questionId: 1,
      totalAttempts: 1,
      correctAttempts: 1,
      correctRate: 1,
      questionText: {
        $ifNull: [
          { $arrayElemAt: ["$questionDetails.text", 0] },
          "Question text not available"
        ]
      }
    }
  },
  { $sort: { correctRate: 1 } }
])`,
      mongoQuery: {
        collection: 'events',
        operation: 'aggregate',
        pipeline: [
          { $match: { type: "question" } },
          { $group: {
              _id: "$context.questionId",
              totalAttempts: { $sum: 1 },
              correctAttempts: {
                $sum: { $cond: [{ $eq: ["$correct", true] }, 1, 0] }
              }
            }
          },
          { $project: {
              questionId: "$_id",
              totalAttempts: 1,
              correctAttempts: 1,
              correctRate: {
                $divide: ["$correctAttempts", "$totalAttempts"]
              },
              _id: 0
            }
          },
          { $lookup: {
              from: "questions",
              let: { qid: { $toLower: "$questionId" } },
              pipeline: [
                { $addFields: { idLower: { $toLower: { $toString: "$_id" } } } },
                { $match: { $expr: { $eq: ["$idLower", "$$qid"] } } }
              ],
              as: "questionDetails"
            }
          },
          { $project: {
              questionId: 1,
              totalAttempts: 1,
              correctAttempts: 1,
              correctRate: 1,
              questionText: {
                $ifNull: [
                  { $arrayElemAt: ["$questionDetails.text", 0] },
                  "Question text not available"
                ]
              }
            }
          },
          { $sort: { correctRate: 1 } }
        ]
      },
      complexity: 'advanced',
      category: 'analytics',
      relationshipInfo: {
        source: {
          collection: 'events',
          field: 'context.questionId'
        },
        target: {
          collection: 'questions',
          field: '_id'
        }
      }
    });
  }

  if (schemaInfo.players && schemaInfo.events) {
    console.log('Generating special patterns for players-events relationship');

    // Player activity over time pattern
    patterns.push({
      id: 'player_activity_over_time',
      type: 'complex',
      collections: ['players', 'events'],
      description: 'Analyze player activity over time',
      template: `db.events.aggregate([
  { $match: { timestamp: { $exists: true } } },
  { $group: {
      _id: {
        playerId: "$playerId",
        date: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } }
      },
      count: { $sum: 1 }
    }
  },
  { $sort: { "_id.date": 1 } },
  { $group: {
      _id: "$_id.playerId",
      activity: {
        $push: {
          date: "$_id.date",
          count: "$count"
        }
      },
      totalEvents: { $sum: "$count" }
    }
  },
  { $sort: { totalEvents: -1 } },
  { $limit: 10 }
])`,
      mongoQuery: {
        collection: 'events',
        operation: 'aggregate',
        pipeline: [
          { $match: { timestamp: { $exists: true } } },
          { $group: {
              _id: {
                playerId: "$playerId",
                date: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } }
              },
              count: { $sum: 1 }
            }
          },
          { $sort: { "_id.date": 1 } },
          { $group: {
              _id: "$_id.playerId",
              activity: {
                $push: {
                  date: "$_id.date",
                  count: "$count"
                }
              },
              totalEvents: { $sum: "$count" }
            }
          },
          { $sort: { totalEvents: -1 } },
          { $limit: 10 }
        ]
      },
      complexity: 'advanced',
      category: 'analytics',
      relationshipInfo: {
        source: {
          collection: 'events',
          field: 'playerId'
        },
        target: {
          collection: 'players',
          field: 'playerId'
        }
      }
    });

    // Player play frequency pattern
    patterns.push({
      id: 'player_play_frequency',
      type: 'complex',
      collections: ['events'],
      description: 'Calculate percentage of players who played more than a specific number of times',
      template: `db.events.aggregate([
  // Group events by player to count how many times each player played
  {
    $group: {
      _id: "$playerId",
      playCount: { $sum: 1 }
    }
  },

  // Add a field to identify players who played more than N times
  {
    $addFields: {
      playedMoreThanNTimes: { $gt: ["$playCount", <threshold>] }
    }
  },

  // Group all results to calculate percentages
  {
    $group: {
      _id: null,
      totalPlayers: { $sum: 1 },
      playersMoreThanNTimes: {
        $sum: { $cond: [{ $eq: ["$playedMoreThanNTimes", true] }, 1, 0] }
      }
    }
  },

  // Calculate the percentage
  {
    $project: {
      _id: 0,
      totalPlayers: 1,
      playersMoreThanNTimes: 1,
      percentage: {
        $multiply: [
          { $divide: ["$playersMoreThanNTimes", "$totalPlayers"] },
          100
        ]
      }
    }
  }
])`,
      mongoQuery: {
        collection: 'events',
        operation: 'aggregate',
        pipeline: [
          // Group events by player to count how many times each player played
          {
            $group: {
              _id: "$playerId",
              playCount: { $sum: 1 }
            }
          },

          // Add a field to identify players who played more than N times
          {
            $addFields: {
              playedMoreThanNTimes: { $gt: ["$playCount", 3] } // Default threshold is 3
            }
          },

          // Group all results to calculate percentages
          {
            $group: {
              _id: null,
              totalPlayers: { $sum: 1 },
              playersMoreThanNTimes: {
                $sum: { $cond: [{ $eq: ["$playedMoreThanNTimes", true] }, 1, 0] }
              }
            }
          },

          // Calculate the percentage
          {
            $project: {
              _id: 0,
              totalPlayers: 1,
              playersMoreThanNTimes: 1,
              percentage: {
                $multiply: [
                  { $divide: ["$playersMoreThanNTimes", "$totalPlayers"] },
                  100
                ]
              }
            }
          }
        ]
      },
      parameters: [
        {
          name: "threshold",
          description: "The threshold number of plays",
          defaultValue: 3,
          type: "number"
        }
      ],
      complexity: 'advanced',
      category: 'analytics'
    });

    // Player play count distribution pattern
    patterns.push({
      id: 'player_play_count_distribution',
      type: 'complex',
      collections: ['events'],
      description: 'Calculate distribution of player play counts',
      template: `db.events.aggregate([
  // Group events by player to count how many times each player played
  {
    $group: {
      _id: "$playerId",
      playCount: { $sum: 1 }
    }
  },

  // Group by play count to get distribution
  {
    $bucket: {
      groupBy: "$playCount",
      boundaries: [1, 2, 3, 5, 10, 20, 50, 100, 500, 1000],
      default: "1000+",
      output: {
        count: { $sum: 1 },
        players: { $push: "$_id" }
      }
    }
  },

  // Calculate percentages
  {
    $addFields: {
      playerCount: { $size: "$players" }
    }
  },

  // Get total player count for percentage calculation
  {
    $group: {
      _id: null,
      totalPlayers: { $sum: "$count" },
      buckets: { $push: "$$ROOT" }
    }
  },

  // Unwind the buckets
  {
    $unwind: "$buckets"
  },

  // Calculate percentages
  {
    $project: {
      _id: "$buckets._id",
      range: "$buckets._id",
      count: "$buckets.count",
      percentage: {
        $multiply: [
          { $divide: ["$buckets.count", "$totalPlayers"] },
          100
        ]
      }
    }
  },

  // Sort by range
  {
    $sort: { range: 1 }
  }
])`,
      mongoQuery: {
        collection: 'events',
        operation: 'aggregate',
        pipeline: [
          // Group events by player to count how many times each player played
          {
            $group: {
              _id: "$playerId",
              playCount: { $sum: 1 }
            }
          },

          // Group by play count to get distribution
          {
            $bucket: {
              groupBy: "$playCount",
              boundaries: [1, 2, 3, 5, 10, 20, 50, 100, 500, 1000],
              default: "1000+",
              output: {
                count: { $sum: 1 },
                players: { $push: "$_id" }
              }
            }
          },

          // Calculate percentages
          {
            $addFields: {
              playerCount: { $size: "$players" }
            }
          },

          // Get total player count for percentage calculation
          {
            $group: {
              _id: null,
              totalPlayers: { $sum: "$count" },
              buckets: { $push: "$$ROOT" }
            }
          },

          // Unwind the buckets
          {
            $unwind: "$buckets"
          },

          // Calculate percentages
          {
            $project: {
              _id: "$buckets._id",
              range: "$buckets._id",
              count: "$buckets.count",
              percentage: {
                $multiply: [
                  { $divide: ["$buckets.count", "$totalPlayers"] },
                  100
                ]
              }
            }
          },

          // Sort by range
          {
            $sort: { range: 1 }
          }
        ]
      },
      complexity: 'advanced',
      category: 'analytics'
    });
  }

  // Generate patterns for multi-level relationships
  console.log('Generating patterns for multi-level relationships...');
  const multiLevelRelationships = relationships.filter(rel => rel.type === 'multi-level');

  for (const relationship of multiLevelRelationships) {
    // Validate the relationship structure
    if (!relationship.path || relationship.path.length < 2) {
      console.log('Skipping invalid multi-level relationship (missing path):', relationship);
      continue;
    }

    const firstRel = relationship.path[0];
    const secondRel = relationship.path[1];

    // Validate first relationship
    if (!firstRel || !firstRel.source || !firstRel.target ||
        !firstRel.source.collection || !firstRel.source.field ||
        !firstRel.target.collection || !firstRel.target.field) {
      console.log('Skipping invalid multi-level relationship (invalid first relationship):', relationship);
      continue;
    }

    // Validate second relationship
    if (!secondRel || !secondRel.source || !secondRel.target ||
        !secondRel.source.collection || !secondRel.source.field ||
        !secondRel.target.collection || !secondRel.target.field) {
      console.log('Skipping invalid multi-level relationship (invalid second relationship):', relationship);
      continue;
    }

    // Now we can safely access these properties
    const sourceCollection = firstRel.source.collection;
    const middleCollection = firstRel.target.collection;
    const targetCollection = secondRel.target.collection;

    console.log(`Generating pattern for multi-level relationship: ${sourceCollection} -> ${middleCollection} -> ${targetCollection}`);

    // Multi-level lookup pattern
    patterns.push({
      id: `multi_level_lookup_${sourceCollection}_${middleCollection}_${targetCollection}`,
      type: 'multi-lookup',
      collections: [sourceCollection, middleCollection, targetCollection],
      description: `Find ${sourceCollection} with related ${middleCollection} and ${targetCollection}`,
      template: `db.${sourceCollection}.aggregate([
  { $lookup: {
      from: "${middleCollection}",
      localField: "${firstRel.source.field}",
      foreignField: "${firstRel.target.field}",
      as: "related_${middleCollection}"
    }
  },
  { $unwind: { path: "$related_${middleCollection}", preserveNullAndEmptyArrays: true } },
  { $lookup: {
      from: "${targetCollection}",
      localField: "related_${middleCollection}.${secondRel.source.field}",
      foreignField: "${secondRel.target.field}",
      as: "related_${targetCollection}"
    }
  },
  { $project: {
      _id: 1,
      ${firstRel.source.field}: 1,
      "related_${middleCollection}": 1,
      "related_${targetCollection}": 1
    }
  },
  { $limit: 50 }
])`,
      mongoQuery: {
        collection: sourceCollection,
        operation: 'aggregate',
        pipeline: [
          { $lookup: {
            from: middleCollection,
            localField: firstRel.source.field,
            foreignField: firstRel.target.field,
            as: `related_${middleCollection}`
          }},
          { $unwind: { path: `$related_${middleCollection}`, preserveNullAndEmptyArrays: true } },
          { $lookup: {
            from: targetCollection,
            localField: `related_${middleCollection}.${secondRel.source.field}`,
            foreignField: secondRel.target.field,
            as: `related_${targetCollection}`
          }},
          { $project: {
            _id: 1,
            [firstRel.source.field]: 1,
            [`related_${middleCollection}`]: 1,
            [`related_${targetCollection}`]: 1
          }},
          { $limit: 50 }
        ]
      },
      complexity: 'advanced',
      category: 'relationship',
      relationshipInfo: {
        path: relationship.path,
        collections: relationship.collections
      }
    });

    // Multi-level count pattern
    patterns.push({
      id: `multi_level_count_${sourceCollection}_${middleCollection}_${targetCollection}`,
      type: 'multi-lookup',
      collections: [sourceCollection, middleCollection, targetCollection],
      description: `Count ${targetCollection} related to ${sourceCollection} through ${middleCollection}`,
      template: `db.${sourceCollection}.aggregate([
  { $lookup: {
      from: "${middleCollection}",
      localField: "${firstRel.source.field}",
      foreignField: "${firstRel.target.field}",
      as: "related_${middleCollection}"
    }
  },
  { $unwind: { path: "$related_${middleCollection}", preserveNullAndEmptyArrays: true } },
  { $lookup: {
      from: "${targetCollection}",
      localField: "related_${middleCollection}.${secondRel.source.field}",
      foreignField: "${secondRel.target.field}",
      as: "related_${targetCollection}"
    }
  },
  { $project: {
      _id: 1,
      ${firstRel.source.field}: 1,
      "${middleCollection}_id": "$related_${middleCollection}._id",
      "related_count": { $size: "$related_${targetCollection}" }
    }
  },
  { $sort: { related_count: -1 } },
  { $limit: 50 }
])`,
      mongoQuery: {
        collection: sourceCollection,
        operation: 'aggregate',
        pipeline: [
          { $lookup: {
            from: middleCollection,
            localField: firstRel.source.field,
            foreignField: firstRel.target.field,
            as: `related_${middleCollection}`
          }},
          { $unwind: { path: `$related_${middleCollection}`, preserveNullAndEmptyArrays: true } },
          { $lookup: {
            from: targetCollection,
            localField: `related_${middleCollection}.${secondRel.source.field}`,
            foreignField: secondRel.target.field,
            as: `related_${targetCollection}`
          }},
          { $project: {
            _id: 1,
            [firstRel.source.field]: 1,
            [`${middleCollection}_id`]: `$related_${middleCollection}._id`,
            related_count: { $size: `$related_${targetCollection}` }
          }},
          { $sort: { related_count: -1 } },
          { $limit: 50 }
        ]
      },
      complexity: 'advanced',
      category: 'relationship',
      relationshipInfo: {
        path: relationship.path,
        collections: relationship.collections
      }
    });

    // Multi-level aggregation pattern
    patterns.push({
      id: `multi_level_aggregate_${sourceCollection}_${middleCollection}_${targetCollection}`,
      type: 'multi-lookup',
      collections: [sourceCollection, middleCollection, targetCollection],
      description: `Aggregate ${targetCollection} metrics related to ${sourceCollection} through ${middleCollection}`,
      template: `db.${sourceCollection}.aggregate([
  { $lookup: {
      from: "${middleCollection}",
      localField: "${firstRel.source.field}",
      foreignField: "${firstRel.target.field}",
      as: "related_${middleCollection}"
    }
  },
  { $unwind: { path: "$related_${middleCollection}", preserveNullAndEmptyArrays: true } },
  { $lookup: {
      from: "${targetCollection}",
      localField: "related_${middleCollection}.${secondRel.source.field}",
      foreignField: "${secondRel.target.field}",
      as: "related_${targetCollection}"
    }
  },
  { $unwind: { path: "$related_${targetCollection}", preserveNullAndEmptyArrays: true } },
  { $group: {
      _id: "$_id",
      ${firstRel.source.field}: { $first: "$${firstRel.source.field}" },
      ${middleCollection}_count: { $sum: 1 },
      ${targetCollection}_count: { $sum: { $cond: [{ $ifNull: ["$related_${targetCollection}", false] }, 1, 0] } }
    }
  },
  { $sort: { ${targetCollection}_count: -1 } },
  { $limit: 50 }
])`,
      mongoQuery: {
        collection: sourceCollection,
        operation: 'aggregate',
        pipeline: [
          { $lookup: {
            from: middleCollection,
            localField: firstRel.source.field,
            foreignField: firstRel.target.field,
            as: `related_${middleCollection}`
          }},
          { $unwind: { path: `$related_${middleCollection}`, preserveNullAndEmptyArrays: true } },
          { $lookup: {
            from: targetCollection,
            localField: `related_${middleCollection}.${secondRel.source.field}`,
            foreignField: secondRel.target.field,
            as: `related_${targetCollection}`
          }},
          { $unwind: { path: `$related_${targetCollection}`, preserveNullAndEmptyArrays: true } },
          { $group: {
            _id: "$_id",
            [firstRel.source.field]: { $first: `$${firstRel.source.field}` },
            [`${middleCollection}_count`]: { $sum: 1 },
            [`${targetCollection}_count`]: { $sum: { $cond: [{ $ifNull: [`$related_${targetCollection}`, false] }, 1, 0] } }
          }},
          { $sort: { [`${targetCollection}_count`]: -1 } },
          { $limit: 50 }
        ]
      },
      complexity: 'advanced',
      category: 'relationship',
      relationshipInfo: {
        path: relationship.path,
        collections: relationship.collections
      }
    });
  }

  console.log(`Generated ${patterns.length} query patterns`);
  return patterns;
}

module.exports = { generateQueryPatterns };
