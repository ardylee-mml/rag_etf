/**
 * Relationship Discoverer Module
 *
 * Discovers relationships between collections by analyzing field names,
 * types, and sample data to identify foreign keys and relationships.
 */
const mongoose = require('mongoose');

/**
 * Discovers relationships between collections based on schema information
 * @param {Object} schemaInfo Schema information from the schema analyzer
 * @returns {Array} Discovered relationships between collections
 */
async function discoverRelationships(schemaInfo) {
  const relationships = [];

  console.log('Starting relationship discovery...');

  // Define known relationships for the Escape To Freedom game
  const knownRelationships = [
    { source: { collection: 'players', field: 'playerId' }, target: { collection: 'events', field: 'playerId' } },
    { source: { collection: 'events', field: 'context.itemId' }, target: { collection: 'items', field: '_id' } },
    { source: { collection: 'events', field: 'context.zoneId' }, target: { collection: 'zones', field: '_id' } },
    { source: { collection: 'events', field: 'context.questionId' }, target: { collection: 'questions', field: '_id' } },
    { source: { collection: 'players', field: 'playerId' }, target: { collection: 'leaderboards', field: 'playerId' } }
  ];

  // First, verify known relationships
  for (const relationship of knownRelationships) {
    console.log(`Verifying known relationship: ${relationship.source.collection}.${relationship.source.field} -> ${relationship.target.collection}.${relationship.target.field}`);

    const verified = await verifyRelationship(
      relationship.source.collection,
      relationship.source.field,
      relationship.target.collection,
      relationship.target.field
    );

    if (verified) {
      relationships.push({
        ...relationship,
        cardinality: verified.cardinality,
        verified: true,
        matchCount: verified.matchCount,
        confidence: verified.confidence,
        description: generateRelationshipDescription(relationship.source.collection, relationship.target.collection)
      });

      console.log(`Verified relationship: ${relationship.source.collection}.${relationship.source.field} -> ${relationship.target.collection}.${relationship.target.field} (${verified.matchCount} matches)`);
    } else {
      console.log(`Could not verify relationship: ${relationship.source.collection}.${relationship.source.field} -> ${relationship.target.collection}.${relationship.target.field}`);

      // Add it anyway with low confidence
      relationships.push({
        ...relationship,
        cardinality: 'unknown',
        verified: false,
        matchCount: 0,
        confidence: 'low',
        description: generateRelationshipDescription(relationship.source.collection, relationship.target.collection)
      });
    }
  }

  // Discover potential new relationships by analyzing field names and types
  for (const sourceCollection in schemaInfo) {
    const sourceFields = schemaInfo[sourceCollection]?.fields || {};

    for (const fieldName in sourceFields) {
      const field = sourceFields[fieldName];

      // Skip _id fields as targets (they are usually referenced by others)
      if (fieldName === '_id') continue;

      // Check if field is a potential foreign key
      if (field.isId || fieldName.endsWith('Id') || fieldName.endsWith('_id')) {
        // Find potential target collections
        for (const targetCollection in schemaInfo) {
          if (targetCollection === sourceCollection) continue;

          const targetFields = schemaInfo[targetCollection]?.fields || {};

          // Check if this field could reference the target collection's _id
          if (targetFields._id) {
            // Skip if this is already a known relationship
            if (relationships.some(r =>
              r.source.collection === sourceCollection &&
              r.source.field === fieldName &&
              r.target.collection === targetCollection &&
              r.target.field === '_id'
            )) {
              continue;
            }

            console.log(`Checking potential relationship: ${sourceCollection}.${fieldName} -> ${targetCollection}._id`);

            // Verify relationship with sample data
            const verified = await verifyRelationship(
              sourceCollection, fieldName, targetCollection, '_id'
            );

            if (verified && verified.matchCount > 0) {
              relationships.push({
                source: {
                  collection: sourceCollection,
                  field: fieldName
                },
                target: {
                  collection: targetCollection,
                  field: '_id'
                },
                cardinality: verified.cardinality,
                verified: true,
                matchCount: verified.matchCount,
                confidence: verified.confidence,
                description: generateRelationshipDescription(sourceCollection, targetCollection),
                discovered: true
              });

              console.log(`Discovered new relationship: ${sourceCollection}.${fieldName} -> ${targetCollection}._id (${verified.matchCount} matches)`);
            }
          }
        }
      }
    }
  }

  // Special case for context.* fields in events collection
  if (schemaInfo.events && schemaInfo.events.fields.context) {
    console.log('Checking for nested relationships in events.context field');

    // Look for context.* fields that might be foreign keys
    for (const fieldName in schemaInfo.events.fields) {
      if (fieldName.startsWith('context.') &&
          (fieldName.endsWith('Id') || fieldName.endsWith('_id'))) {

        const targetCollectionName = fieldName
          .replace('context.', '')
          .replace('Id', '')
          .replace('_id', '')
          .toLowerCase();

        // Check if a collection with this name exists
        if (schemaInfo[targetCollectionName]) {
          // Skip if this is already a known relationship
          if (relationships.some(r =>
            r.source.collection === 'events' &&
            r.source.field === fieldName &&
            r.target.collection === targetCollectionName
          )) {
            continue;
          }

          console.log(`Checking potential context relationship: events.${fieldName} -> ${targetCollectionName}._id`);

          // Verify relationship with sample data
          const verified = await verifyRelationship(
            'events', fieldName, targetCollectionName, '_id'
          );

          if (verified && verified.matchCount > 0) {
            relationships.push({
              source: {
                collection: 'events',
                field: fieldName
              },
              target: {
                collection: targetCollectionName,
                field: '_id'
              },
              cardinality: verified.cardinality,
              verified: true,
              matchCount: verified.matchCount,
              confidence: verified.confidence,
              description: `Events record ${targetCollectionName} interactions`,
              discovered: true
            });

            console.log(`Discovered new context relationship: events.${fieldName} -> ${targetCollectionName}._id (${verified.matchCount} matches)`);
          }
        }
      }
    }
  }

  // Discover multi-level relationships (relationships between related collections)
  console.log('Discovering multi-level relationships...');
  const multiLevelRelationships = [];

  // Create a map of collections to their relationships for easier lookup
  const relationshipMap = {};
  relationships.forEach(rel => {
    if (!relationshipMap[rel.source.collection]) {
      relationshipMap[rel.source.collection] = [];
    }
    relationshipMap[rel.source.collection].push(rel);
  });

  // Find chains of relationships (A -> B -> C)
  for (const firstRel of relationships) {
    const middleCollection = firstRel.target.collection;

    // Check if the middle collection has relationships to other collections
    if (relationshipMap[middleCollection]) {
      for (const secondRel of relationshipMap[middleCollection]) {
        // Skip self-referential relationships
        if (secondRel.target.collection === firstRel.source.collection) {
          continue;
        }

        // Validate the relationships before creating a multi-level relationship
        if (!firstRel.source || !firstRel.source.collection || !firstRel.source.field ||
            !firstRel.target || !firstRel.target.collection || !firstRel.target.field ||
            !secondRel.source || !secondRel.source.collection || !secondRel.source.field ||
            !secondRel.target || !secondRel.target.collection || !secondRel.target.field) {
          console.log('Skipping invalid multi-level relationship due to missing properties');
          continue;
        }

        // Create a multi-level relationship
        const multiLevelRel = {
          path: [
            {
              source: {
                collection: firstRel.source.collection,
                field: firstRel.source.field
              },
              target: {
                collection: firstRel.target.collection,
                field: firstRel.target.field
              }
            },
            {
              source: {
                collection: secondRel.source.collection,
                field: secondRel.source.field
              },
              target: {
                collection: secondRel.target.collection,
                field: secondRel.target.field
              }
            }
          ],
          collections: [
            firstRel.source.collection,
            middleCollection,
            secondRel.target.collection
          ],
          description: `${firstRel.source.collection} connect to ${secondRel.target.collection} through ${middleCollection}`,
          confidence: Math.min(
            confidenceToNumber(firstRel.confidence),
            confidenceToNumber(secondRel.confidence)
          ) / 100,
          type: 'multi-level'
        };

        // Add only if this exact path doesn't already exist
        const pathExists = multiLevelRelationships.some(mlr =>
          mlr.path[0].source.collection === multiLevelRel.path[0].source.collection &&
          mlr.path[0].target.collection === multiLevelRel.path[0].target.collection &&
          mlr.path[1].source.collection === multiLevelRel.path[1].source.collection &&
          mlr.path[1].target.collection === multiLevelRel.path[1].target.collection
        );

        if (!pathExists) {
          multiLevelRelationships.push(multiLevelRel);
          console.log(`Discovered multi-level relationship: ${firstRel.source.collection} -> ${middleCollection} -> ${secondRel.target.collection}`);
        }
      }
    }
  }

  // Add multi-level relationships to the result
  relationships.push(...multiLevelRelationships);

  console.log(`Discovered ${relationships.length} relationships in total (including ${multiLevelRelationships.length} multi-level relationships)`);
  return relationships;
}

/**
 * Verifies a potential relationship between two collections
 * @param {String} sourceCollection Source collection name
 * @param {String} sourceField Source field name
 * @param {String} targetCollection Target collection name
 * @param {String} targetField Target field name
 * @returns {Object|null} Verification result or null if not verified
 */
async function verifyRelationship(sourceCollection, sourceField, targetCollection, targetField) {
  try {
    // Get a sample document from source collection with the specified field
    const sourceDoc = await mongoose.connection.db.collection(sourceCollection)
      .findOne({ [sourceField]: { $exists: true, $ne: null } });

    if (!sourceDoc) {
      console.log(`No document found in ${sourceCollection} with field ${sourceField}`);
      return null;
    }

    // Extract the value from the source document
    let sourceValue = sourceDoc[sourceField];
    if (sourceField.includes('.')) {
      // Handle nested fields
      sourceValue = sourceField.split('.').reduce((obj, key) => obj && obj[key], sourceDoc);
    }

    if (!sourceValue) {
      console.log(`Field ${sourceField} is null or undefined in sample document from ${sourceCollection}`);
      return null;
    }

    // Try to find matching document in target collection
    // Handle different types of IDs (ObjectId vs string)
    let targetDoc;
    let matchCount = 0;

    // Try direct match first
    targetDoc = await mongoose.connection.db.collection(targetCollection)
      .findOne({ [targetField]: sourceValue });

    if (!targetDoc && typeof sourceValue === 'string') {
      // Try case-insensitive match for string IDs
      const regex = new RegExp(`^${sourceValue}$`, 'i');
      targetDoc = await mongoose.connection.db.collection(targetCollection)
        .findOne({ [targetField]: regex });
    }

    if (targetDoc) {
      // Count how many documents in source collection reference this target
      matchCount = await mongoose.connection.db.collection(sourceCollection)
        .countDocuments({ [sourceField]: sourceValue });

      // Determine cardinality
      const cardinality = await determineCardinality(
        sourceCollection, sourceField, targetCollection, targetField
      );

      // Calculate confidence based on match count
      let confidence = 'low';
      if (matchCount > 100) confidence = 'high';
      else if (matchCount > 10) confidence = 'medium';

      return {
        cardinality,
        matchCount,
        confidence,
        sourceValue,
        targetValue: targetDoc[targetField]
      };
    }

    return null;
  } catch (error) {
    console.error(`Error verifying relationship ${sourceCollection}.${sourceField} -> ${targetCollection}.${targetField}:`, error);
    return null;
  }
}

/**
 * Determines the cardinality of a relationship
 * @param {String} sourceCollection Source collection name
 * @param {String} sourceField Source field name
 * @param {String} targetCollection Target collection name
 * @param {String} targetField Target field name
 * @returns {String} Cardinality type (one-to-one, one-to-many, many-to-one, many-to-many)
 */
async function determineCardinality(sourceCollection, sourceField, targetCollection, targetField) {
  try {
    // Check if multiple source documents reference the same target
    const pipeline = [
      { $match: { [sourceField]: { $exists: true, $ne: null } } },
      { $group: { _id: `$${sourceField}`, count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
      { $limit: 1 }
    ];

    const multipleSourcesPerTarget = await mongoose.connection.db.collection(sourceCollection)
      .aggregate(pipeline).toArray();

    const manyToOne = multipleSourcesPerTarget.length > 0;

    // Check if a source document references multiple targets
    // This is harder to determine without knowing the exact data model
    // For simplicity, we'll assume it's possible in most cases
    const oneToMany = true;

    if (manyToOne && oneToMany) {
      return 'many-to-many';
    } else if (manyToOne) {
      return 'many-to-one';
    } else if (oneToMany) {
      return 'one-to-many';
    } else {
      return 'one-to-one';
    }
  } catch (error) {
    console.error(`Error determining cardinality for ${sourceCollection}.${sourceField} -> ${targetCollection}.${targetField}:`, error);
    return 'unknown';
  }
}

/**
 * Generates a human-readable description of a relationship
 * @param {String} sourceCollection Source collection name
 * @param {String} targetCollection Target collection name
 * @returns {String} Human-readable description
 */
function generateRelationshipDescription(sourceCollection, targetCollection) {
  const descriptions = {
    'players-events': 'Players generate events through their actions',
    'events-players': 'Events are associated with players',
    'players-leaderboards': 'Players have scores on leaderboards',
    'leaderboards-players': 'Leaderboard entries belong to players',
    'events-items': 'Events record item interactions',
    'items-events': 'Items are used in events',
    'events-zones': 'Events track player movement through zones',
    'zones-events': 'Zones contain events',
    'events-questions': 'Events record question responses',
    'questions-events': 'Questions are answered in events',
    'questions-campaigns': 'Questions are part of campaigns',
    'campaigns-questions': 'Campaigns contain questions'
  };

  const key = `${sourceCollection}-${targetCollection}`;
  return descriptions[key] || `${sourceCollection} are related to ${targetCollection}`;
}

/**
 * Converts confidence string to a numeric value
 * @param {String} confidence Confidence level (low, medium, high)
 * @returns {Number} Numeric confidence value
 */
function confidenceToNumber(confidence) {
  switch (confidence) {
    case 'high': return 100;
    case 'medium': return 70;
    case 'low': return 40;
    default: return 30;
  }
}

module.exports = {
  discoverRelationships,
  verifyRelationship,
  determineCardinality,
  generateRelationshipDescription,
  confidenceToNumber
};
