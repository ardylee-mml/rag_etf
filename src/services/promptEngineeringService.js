const mongoose = require('mongoose');
const mongodbSchema = require('mongodb-schema');

class PromptEngineeringService {
    constructor() {
        // Context window types
        this.contextTypes = {
            SCHEMA: 'schema',      // Database schema and structure
            BUSINESS: 'business',  // Business rules and constraints
            SECURITY: 'security'   // Security and access controls
        };

        // Safety guardrails for write operations
        this.writeOperations = ['insert', 'update', 'delete', 'remove', 'drop'];
        this.sensitiveFields = ['password', 'secret', 'token', 'key', 'credit_card', 'ssn'];

        // Initialize schema cache
        this.schemaCache = new Map();
        this.schemaCacheTTL = 1000 * 60 * 30; // 30 minutes
    }

    async analyzeCollectionSchema(collectionName) {
        try {
            // Check cache first
            const cachedSchema = this.schemaCache.get(collectionName);
            if (cachedSchema && cachedSchema.timestamp > Date.now() - this.schemaCacheTTL) {
                return cachedSchema.schema;
            }

            const db = mongoose.connection.db;
            const collection = db.collection(collectionName);

            // Sample documents for schema analysis
            const sampleDocs = await collection.find().limit(100).toArray();

            // Try to use mongodbSchema.SchemaAnalyzer if available
            let schema;
            try {
                const schemaAnalyzer = new mongodbSchema.SchemaAnalyzer();
                schema = await schemaAnalyzer.analyze(sampleDocs);
            } catch (analyzeError) {
                console.error('mongodbSchema.SchemaAnalyzer failed, using fallback schema analysis:', analyzeError);
                // Fallback: Create a basic schema manually
                schema = this.createFallbackSchema(sampleDocs, collectionName);
            }

            // Enhance schema with additional metadata
            const enhancedSchema = this.enhanceSchema(schema);

            // Cache the result
            this.schemaCache.set(collectionName, {
                schema: enhancedSchema,
                timestamp: Date.now()
            });

            return enhancedSchema;
        } catch (error) {
            console.error('Schema analysis error:', error);
            // Return a default schema as fallback
            return this.createDefaultSchema(collectionName);
        }
    }

    createFallbackSchema(sampleDocs, collectionName) {
        console.log(`Creating fallback schema for ${collectionName} with ${sampleDocs.length} sample documents`);

        // Initialize schema
        const schema = {
            fields: []
        };

        // If we have sample documents, analyze the first one
        if (sampleDocs.length > 0) {
            const sampleDoc = sampleDocs[0];

            // Extract fields from the sample document
            Object.keys(sampleDoc).forEach(fieldName => {
                const value = sampleDoc[fieldName];
                const fieldType = this.getFieldType(value);

                schema.fields.push({
                    name: fieldName,
                    types: [fieldType],
                    probability: 1
                });
            });
        } else {
            // If no sample documents, use predefined schemas based on collection name
            if (collectionName === 'events') {
                schema.fields = [
                    { name: 'playerId', types: ['string'], probability: 1 },
                    { name: 'type', types: ['string'], probability: 1 },
                    { name: 'time', types: ['date'], probability: 1 },
                    { name: 'context', types: ['object'], probability: 0.8 }
                ];
            } else if (collectionName === 'players') {
                schema.fields = [
                    { name: 'playerId', types: ['string'], probability: 1 },
                    { name: 'name', types: ['string'], probability: 1 },
                    { name: 'email', types: ['string'], probability: 0.8 }
                ];
            } else if (collectionName === 'questions') {
                schema.fields = [
                    { name: '_id', types: ['string'], probability: 1 },
                    { name: 'text', types: ['string'], probability: 1 },
                    { name: 'choices', types: ['array'], probability: 1 }
                ];
            } else if (collectionName === 'items') {
                schema.fields = [
                    { name: '_id', types: ['string'], probability: 1 },
                    { name: 'name', types: ['string'], probability: 1 },
                    { name: 'type', types: ['string'], probability: 1 }
                ];
            } else if (collectionName === 'zones') {
                schema.fields = [
                    { name: '_id', types: ['string'], probability: 1 },
                    { name: 'name', types: ['string'], probability: 1 },
                    { name: 'description', types: ['string'], probability: 0.8 }
                ];
            } else if (collectionName === 'leaderboards') {
                schema.fields = [
                    { name: 'playerId', types: ['string'], probability: 1 },
                    { name: 'playerName', types: ['string'], probability: 1 },
                    { name: 'score', types: ['number'], probability: 1 },
                    { name: 'level', types: ['number'], probability: 0.8 }
                ];
            }
        }

        return schema;
    }

    getFieldType(value) {
        if (value === null) return 'null';
        if (Array.isArray(value)) return 'array';
        if (value instanceof Date) return 'date';
        if (typeof value === 'object') return 'object';
        return typeof value;
    }

    createDefaultSchema(collectionName) {
        console.log(`Creating default schema for ${collectionName}`);

        // Create a basic default schema
        return {
            fields: [
                { name: '_id', types: ['ObjectId'], probability: 1, required: true },
                { name: 'playerId', types: ['string'], probability: 0.8 },
                { name: 'type', types: ['string'], probability: 0.8 },
                { name: 'name', types: ['string'], probability: 0.7 }
            ],
            relationships: [
                { field: 'playerId', type: 'reference' }
            ],
            constraints: [],
            sensitiveFields: []
        };
    }

    enhanceSchema(schema) {
        const enhanced = {
            fields: [],
            relationships: [],
            constraints: [],
            sensitiveFields: []
        };

        schema.fields.forEach(field => {
            // Basic field information
            const fieldInfo = {
                name: field.name,
                types: field.types,
                required: field.probability === 1,
                probability: field.probability
            };

            // Detect relationships
            if (field.types.includes('ObjectId')) {
                enhanced.relationships.push({
                    field: field.name,
                    type: 'reference'
                });
            }

            // Identify sensitive fields
            if (this.sensitiveFields.some(sensitive => field.name.toLowerCase().includes(sensitive))) {
                enhanced.sensitiveFields.push(field.name);
            }

            enhanced.fields.push(fieldInfo);
        });

        return enhanced;
    }

    generateSystemPrompt(schema, queryContext) {
        const contextWindows = this.buildContextWindows(schema, queryContext);

        return `You are an expert MongoDB query engineer specialized in translating natural language questions into MongoDB aggregation pipelines. You have deep knowledge of MongoDB's aggregation framework and data modeling concepts. You have the following context:

${contextWindows.schema}

${contextWindows.business}

${contextWindows.security}

Your primary responsibility is to:
1. Carefully analyze the user's natural language question to understand their intent
2. Identify the key entities, conditions, and operations required
3. Map these requirements to appropriate MongoDB aggregation stages
4. Generate a precise, optimized MongoDB aggregation pipeline that directly answers the question

MongoDB Aggregation Framework Guidelines:
1. Use $match early in the pipeline to filter documents and improve performance
2. Use $group to aggregate data, with appropriate accumulators ($sum, $avg, $max, etc.)
3. Use $lookup to join data from related collections
4. Use $project to shape the output and include only necessary fields
5. Use $sort to order results as needed (1 for ascending, -1 for descending)
6. Use $limit and $skip for pagination when appropriate
7. Use $unwind to deconstruct arrays when needed
8. Use $count for counting operations or $group with $sum for more complex counting

Data Model Relationships:
- Events collection contains player activities with playerId field
- Players collection contains player details with playerId as identifier
- Items are referenced in events through context.itemId
- Zones are referenced in events through context.zoneId
- Questions are referenced in events through context.questionId

For player activity queries (e.g., "How many players played more than X times?"):
- Group by playerId using $group with _id: "$playerId"
- Count occurrences using $sum: 1
- Filter based on the count using $match with appropriate comparison operator
- Use $count for total or $lookup to get player details if needed

For leaderboard and score queries:
- For average score: Use $group with $avg operator on the score field
- For highest/top scores: Use $sort with score: -1 and $limit
- For player rankings: Use $sort and $project to include relevant fields
- For score statistics: Use $group with operators like $avg, $min, $max, $sum

For question analysis:
- Filter for events with type: "question"
- Reference questions through context.questionId
- Track correct/incorrect answers using context.choiceId

Your response must be a valid MongoDB aggregation pipeline in JSON array format that directly answers the user's question. Do not include explanations or comments in your response - only the pipeline array.`;
    }

    buildContextWindows(schema, queryContext) {
        return {
            schema: this.buildSchemaContext(schema),
            business: this.buildBusinessContext(schema, queryContext),
            security: this.buildSecurityContext(schema)
        };
    }

    buildSchemaContext(schema) {
        let context = 'Schema Context:\n';

        // Add fields
        context += '\nFields:\n';
        schema.fields.forEach(field => {
            context += `- ${field.name} (${field.types.join('|')})${field.required ? ' [Required]' : ''}\n`;
        });

        // Add relationships
        if (schema.relationships.length > 0) {
            context += '\nRelationships:\n';
            schema.relationships.forEach(rel => {
                context += `- ${rel.field}: ${rel.type}\n`;
            });
        }

        // Add detailed collection relationships based on the collection name
        context += '\nDetailed Collection Relationships:\n';

        // Events collection relationships
        context += `- events.playerId → players.playerId (Many events belong to one player)\n`;
        context += `- events.context.itemId → items._id (Many events reference one item)\n`;
        context += `- events.context.zoneId → zones._id (Many events reference one zone)\n`;
        context += `- events.context.questionId → questions._id (Many events reference one question)\n`;
        context += `- leaderboards.playerId → players.playerId (One leaderboard entry per player)\n`;

        // Add information about event types
        context += '\nEvent Types:\n';
        context += `- "signin": Player login events\n`;
        context += `- "question": Question answer events (contains context.questionId and context.choiceId)\n`;
        context += `- "item": Item interaction events (contains context.itemId)\n`;
        context += `- "zone": Zone visit events (contains context.zoneId)\n`;

        // Add information about the questions collection
        context += '\nQuestions Structure:\n';
        context += `- questions._id: Unique identifier for the question\n`;
        context += `- questions.text: The question text\n`;
        context += `- questions.choices: Array of possible answers\n`;
        context += `- questions.choices._id: Unique identifier for each choice\n`;
        context += `- questions.choices.text: The text of the choice\n`;
        context += `- questions.choices.notes: Present only on correct answers\n`;

        // Add information about the leaderboards collection
        context += '\nLeaderboards Structure:\n';
        context += `- leaderboards._id: Unique identifier for the leaderboard entry\n`;
        context += `- leaderboards.playerId: ID of the player (references players.playerId)\n`;
        context += `- leaderboards.playerName: Name of the player\n`;
        context += `- leaderboards.score: Numeric score of the player\n`;
        context += `- leaderboards.level: Current level of the player\n`;
        context += `- leaderboards.lastUpdated: Timestamp of the last update\n`;

        return context;
    }

    buildBusinessContext(schema, queryContext) {
        let context = 'Business Context:\n';

        // Add field constraints
        schema.fields.forEach(field => {
            if (field.required) {
                context += `- ${field.name} must always be present\n`;
            }
            if (field.probability < 1) {
                context += `- ${field.name} is optional (${Math.round(field.probability * 100)}% present)\n`;
            }
        });

        // Add query-specific business rules
        if (queryContext?.businessRules) {
            context += '\nBusiness Rules:\n';
            queryContext.businessRules.forEach(rule => {
                context += `- ${rule}\n`;
            });
        }

        return context;
    }

    buildSecurityContext(schema) {
        let context = 'Security Context:\n';

        // Add sensitive field warnings
        if (schema.sensitiveFields.length > 0) {
            context += '\nSensitive Fields (Never Expose):\n';
            schema.sensitiveFields.forEach(field => {
                context += `- ${field}\n`;
            });
        }

        // Add write operation safety rules
        context += '\nWrite Operation Safety:\n';
        context += '- Always include query conditions for updates/deletes\n';
        context += '- Never perform collection-wide deletions\n';
        context += '- Validate data types before insertion\n';
        context += '- Use atomic operations when possible\n';

        return context;
    }

    validateWriteOperation(query, schema) {
        const issues = [];

        // Check for dangerous write operations
        this.writeOperations.forEach(op => {
            if (query.toLowerCase().includes(op)) {
                // Ensure conditions are present
                if (!query.toLowerCase().includes('where') && !query.toLowerCase().includes('condition')) {
                    issues.push(`Write operation '${op}' detected without conditions`);
                }

                // Check for collection-wide operations
                if (query.toLowerCase().includes('drop collection') || query.toLowerCase().includes('remove all')) {
                    issues.push('Collection-wide deletion detected');
                }
            }
        });

        // Check for sensitive field exposure
        schema.sensitiveFields.forEach(field => {
            if (query.toLowerCase().includes(field.toLowerCase())) {
                issues.push(`Query contains sensitive field: ${field}`);
            }
        });

        return {
            safe: issues.length === 0,
            issues
        };
    }

    async generatePromptWithContext(collectionName, query, customContext = {}) {
        // Analyze schema
        const schema = await this.analyzeCollectionSchema(collectionName);
        if (!schema) {
            throw new Error('Failed to analyze collection schema');
        }

        // Incorporate any provided schema info
        if (customContext.schemaInfo) {
            this.enhanceSchemaWithCustomInfo(schema, customContext.schemaInfo);
        }

        // Generate dynamic prompt
        const systemPrompt = this.generateSystemPrompt(schema, customContext);

        // Validate if it's a write operation
        const safetyCheck = this.validateWriteOperation(query, schema);
        if (!safetyCheck.safe) {
            return {
                prompt: null,
                error: 'Safety validation failed',
                issues: safetyCheck.issues
            };
        }

        // Add specific instructions for MongoDB aggregation pipelines with detailed examples
        const enhancedPrompt = systemPrompt + `\n\nHere are examples of natural language queries and their corresponding MongoDB aggregation pipelines:

Example 1: "How many players played more than 5 times?"
[
  { "$group": { "_id": "$playerId", "count": { "$sum": 1 } } },
  { "$match": { "count": { "$gt": 5 } } },
  { "$count": "totalPlayers" }
]

Example 2: "Show me players who played exactly 3 times"
[
  { "$group": { "_id": "$playerId", "count": { "$sum": 1 } } },
  { "$match": { "count": { "$eq": 3 } } },
  { "$lookup": { "from": "players", "localField": "_id", "foreignField": "playerId", "as": "playerDetails" } },
  { "$unwind": { "path": "$playerDetails", "preserveNullAndEmptyArrays": true } },
  { "$project": { "playerId": "$_id", "playerName": "$playerDetails.name", "count": 1, "_id": 0 } }
]

Example 3: "What are the most answered questions?"
[
  { "$match": { "type": "question" } },
  { "$group": { "_id": "$context.questionId", "count": { "$sum": 1 } } },
  { "$lookup": { "from": "questions", "localField": "_id", "foreignField": "_id", "as": "questionDetails" } },
  { "$unwind": { "path": "$questionDetails", "preserveNullAndEmptyArrays": true } },
  { "$project": { "questionId": "$_id", "questionText": "$questionDetails.text", "count": 1, "_id": 0 } },
  { "$sort": { "count": -1 } }
]

Example 4: "How many players played more than 10 times?"
[
  { "$group": { "_id": "$playerId", "count": { "$sum": 1 } } },
  { "$match": { "count": { "$gt": 10 } } },
  { "$count": "totalPlayers" }
]

Example 5: "Which zones have been visited the most?"
[
  { "$match": { "type": "zone" } },
  { "$group": { "_id": "$context.zoneId", "visits": { "$sum": 1 } } },
  { "$lookup": { "from": "zones", "localField": "_id", "foreignField": "_id", "as": "zoneDetails" } },
  { "$unwind": { "path": "$zoneDetails", "preserveNullAndEmptyArrays": true } },
  { "$project": { "zoneId": "$_id", "zoneName": "$zoneDetails.name", "visits": 1, "_id": 0 } },
  { "$sort": { "visits": -1 } }
]

Example 6: "How many players played more than 2 times?"
[
  { "$group": { "_id": "$playerId", "count": { "$sum": 1 } } },
  { "$match": { "count": { "$gt": 2 } } },
  { "$count": "totalPlayers" }
]

Example 7: "What is the average player score?"
[
  { "$group": { "_id": null, "averageScore": { "$avg": "$score" } } },
  { "$project": { "_id": 0, "averageScore": 1 } }
]

Example 8: "Who has the highest score in the leaderboards?"
[
  { "$sort": { "score": -1 } },
  { "$limit": 1 },
  { "$project": { "_id": 0, "playerName": 1, "score": 1 } }
]

Example 9: "Show me the top 5 players by score"
[
  { "$sort": { "score": -1 } },
  { "$limit": 5 },
  { "$project": { "_id": 0, "playerName": 1, "score": 1, "level": 1 } }
]

Remember these important field mappings:
- Players are identified by 'playerId' (not '_id')
- Events reference players through 'playerId'
- Events reference items through 'context.itemId'
- Events reference zones through 'context.zoneId'
- Events reference questions through 'context.questionId'
- Items, zones, and questions use '_id' as their primary key

Your response must be a valid MongoDB aggregation pipeline in JSON array format with no additional text or explanation.`;

        return {
            prompt: enhancedPrompt,
            schema,
            safetyCheck
        };
    }

    enhanceSchemaWithCustomInfo(schema, schemaInfo) {
        // Add custom field mappings to the schema
        if (schemaInfo) {
            // Add relationships based on field mappings
            if (schemaInfo.players && schemaInfo.players.idField) {
                schema.relationships.push({
                    field: schemaInfo.players.idField,
                    type: 'player_id'
                });
            }

            if (schemaInfo.events) {
                if (schemaInfo.events.playerIdField) {
                    schema.relationships.push({
                        field: schemaInfo.events.playerIdField,
                        type: 'player_reference'
                    });
                }

                if (schemaInfo.events.itemIdField) {
                    schema.relationships.push({
                        field: schemaInfo.events.itemIdField,
                        type: 'item_reference'
                    });
                }

                if (schemaInfo.events.zoneIdField) {
                    schema.relationships.push({
                        field: schemaInfo.events.zoneIdField,
                        type: 'zone_reference'
                    });
                }

                if (schemaInfo.events.questionIdField) {
                    schema.relationships.push({
                        field: schemaInfo.events.questionIdField,
                        type: 'question_reference'
                    });
                }
            }
        }
    }
}

module.exports = new PromptEngineeringService();