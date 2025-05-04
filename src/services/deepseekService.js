const axios = require('axios');
const { LRUCache } = require('lru-cache');
const mongodbSchema = require('mongodb-schema');
const mongoose = require('mongoose');
const promptEngineeringService = require('./promptEngineeringService');
const collectionSummaryService = require('./collectionSummaryService');

class DeepSeekService {
    constructor() {
        this.apiKey = process.env.DEEPSEEK_API_KEY;
        this.apiEndpoint = 'https://api.deepseek.com/v1/chat/completions';
        this.maxRetries = 3;
        this.retryDelay = 1000; // 1 second

        // Initialize conversation history cache with separate windows
        this.conversationCache = new LRUCache({
            max: 1000,
            ttl: 1000 * 60 * 60, // 1 hour
        });

        // Initialize token usage monitoring
        this.tokenUsage = {
            daily: 0,
            lastReset: new Date(),
        };

        // Query type temperature mappings
        this.temperatureSettings = {
            factual: 0.1,    // Precise, factual queries
            analytical: 0.3,  // Analysis and comparisons
            creative: 0.7,    // More creative responses
            default: 0.5     // Default temperature
        };
    }

    // ... [other methods remain unchanged] ...

    extractMongoDBPipeline(content, query, collectionName) {
        try {
            console.log('Extracting MongoDB pipeline from LLM response...');
            console.log('Response content preview:', content.substring(0, 100) + '...');
            
            // Special case for item queries with context.action filtering
            const lowerQuery = query.toLowerCase();
            
            // Handle specific item query patterns
            if (lowerQuery.includes('item') && collectionName === 'events') {
                console.log('Detected item-related query');
                
                // Check for specific item query patterns
                if (lowerQuery.includes('top') && lowerQuery.includes('pickup')) {
                    console.log('Detected top items pickup query');
                    
                    // Extract limit from query (default to 5 if not specified)
                    let limit = 5;
                    const limitMatch = lowerQuery.match(/top\s+(\d+)/);
                    if (limitMatch) {
                        limit = parseInt(limitMatch[1]);
                    }
                    console.log(`Using limit: ${limit}`);
                    
                    return [
                        { $match: { 
                            type: 'item',
                            'context.action': 'pickup'
                        }},
                        { $group: {
                            _id: '$context.itemId',
                            count: { $sum: 1 }
                        }},
                        { $lookup: {
                            from: 'items',
                            localField: '_id',
                            foreignField: '_id',
                            as: 'itemDetails'
                        }},
                        { $unwind: { path: '$itemDetails', preserveNullAndEmptyArrays: true } },
                        { $project: {
                            itemId: '$_id',
                            itemName: '$itemDetails.name',
                            count: 1,
                            _id: 0
                        }},
                        { $sort: { count: -1 } },
                        { $limit: limit }
                    ];
                }
                
                // Check for context.action filtering
                if (lowerQuery.includes('action') || 
                    lowerQuery.includes('pickup') || 
                    lowerQuery.includes('drop') || 
                    lowerQuery.includes('use')) {
                    
                    console.log('Detected item query with action filtering');
                    
                    // Determine the action type
                    let action = null;
                    if (lowerQuery.includes('pickup')) action = 'pickup';
                    else if (lowerQuery.includes('drop')) action = 'drop';
                    else if (lowerQuery.includes('use')) action = 'use';
                    
                    // Build the match condition
                    const matchCondition = { type: 'item' };
                    if (action) {
                        matchCondition['context.action'] = action;
                    }
                    
                    // Extract limit from query (default to all if not specified)
                    let limit = null;
                    const limitMatch = lowerQuery.match(/top\s+(\d+)/);
                    if (limitMatch) {
                        limit = parseInt(limitMatch[1]);
                    }
                    
                    const pipeline = [
                        { $match: matchCondition },
                        { $group: {
                            _id: '$context.itemId',
                            count: { $sum: 1 }
                        }},
                        { $lookup: {
                            from: 'items',
                            localField: '_id',
                            foreignField: '_id',
                            as: 'itemDetails'
                        }},
                        { $unwind: { path: '$itemDetails', preserveNullAndEmptyArrays: true } },
                        { $project: {
                            itemId: '$_id',
                            itemName: '$itemDetails.name',
                            count: 1,
                            _id: 0
                        }},
                        { $sort: { count: -1 } }
                    ];
                    
                    // Add limit if specified
                    if (limit) {
                        pipeline.push({ $limit: limit });
                    }
                    
                    return pipeline;
                }
            }

            // Special case for player play frequency queries
            if (lowerQuery.includes('percentage') &&
                lowerQuery.includes('player') &&
                lowerQuery.includes('played more than') &&
                collectionName === 'events') {

                console.log('Detected player play frequency query, using direct pattern');

                // Extract the threshold from the query
                const thresholdMatch = lowerQuery.match(/more than (\d+) times/);
                const threshold = thresholdMatch ? parseInt(thresholdMatch[1]) : 3;

                console.log(`Using threshold: ${threshold}`);

                return [
                    // Group events by player to count how many times each player played
                    {
                        $group: {
                            _id: "$playerId",
                            playCount: { $sum: 1 }
                        }
                    },

                    // Add a field to identify players who played more than threshold times
                    {
                        $addFields: {
                            playedMoreThanThreshold: { $gt: ["$playCount", threshold] }
                        }
                    },

                    // Group all results to calculate percentages
                    {
                        $group: {
                            _id: null,
                            totalPlayers: { $sum: 1 },
                            playersMoreThanThreshold: {
                                $sum: { $cond: [{ $eq: ["$playedMoreThanThreshold", true] }, 1, 0] }
                            }
                        }
                    },

                    // Calculate the percentage
                    {
                        $project: {
                            _id: 0,
                            totalPlayers: 1,
                            playersMoreThanThreshold: 1,
                            percentage: {
                                $multiply: [
                                    { $divide: ["$playersMoreThanThreshold", "$totalPlayers"] },
                                    100
                                ]
                            }
                        }
                    }
                ];
            }

            // Try to parse the content directly as JSON
            try {
                console.log('Attempting to parse content directly as JSON...');
                const pipeline = JSON.parse(content);
                if (Array.isArray(pipeline)) {
                    console.log('Successfully parsed content as JSON array!');
                    console.log('Pipeline:', JSON.stringify(pipeline));

                    // Check if this is a date-based query and the pipeline doesn't have a date filter
                    const hasDateReference = this.hasDateReference(lowerQuery);
                    const hasDateFilter = this.pipelineHasDateFilter(pipeline);

                    console.log('Query has date reference:', hasDateReference);
                    console.log('Pipeline has date filter:', hasDateFilter);

                    if (hasDateReference && !hasDateFilter && collectionName === 'events') {
                        console.log('Adding missing date filter to pipeline...');
                        const dateFilter = this.extractDateFilter(lowerQuery);
                        if (dateFilter) {
                            console.log('Date filter extracted:', JSON.stringify(dateFilter));
                            // Add the date filter to the beginning of the pipeline
                            pipeline.unshift({ $match: dateFilter });
                            console.log('Updated pipeline with date filter:', JSON.stringify(pipeline));
                        }
                    }

                    return pipeline;
                } else {
                    console.log('Content parsed as JSON but is not an array:', typeof pipeline);
                }
            } catch (e) {
                console.log('Content is not valid JSON, continuing with extraction:', e.message);
            }

            // Try to extract JSON array from the content using regex
            console.log('Attempting to extract JSON array using regex...');
            const jsonMatch = content.match(/\[\s*\{.*\}\s*\]/s);
            if (jsonMatch) {
                console.log('Found potential JSON array in content!');
                try {
                    const extractedPipeline = JSON.parse(jsonMatch[0]);
                    console.log('Successfully parsed extracted JSON!');
                    console.log('Pipeline:', JSON.stringify(extractedPipeline));

                    // Check if this is a date-based query and the pipeline doesn't have a date filter
                    const lowerQuery = query.toLowerCase();
                    const hasDateReference = this.hasDateReference(lowerQuery);
                    const hasDateFilter = this.pipelineHasDateFilter(extractedPipeline);

                    console.log('Query has date reference:', hasDateReference);
                    console.log('Pipeline has date filter:', hasDateFilter);

                    if (hasDateReference && !hasDateFilter && collectionName === 'events') {
                        console.log('Adding missing date filter to pipeline...');
                        const dateFilter = this.extractDateFilter(lowerQuery);
                        if (dateFilter) {
                            console.log('Date filter extracted:', JSON.stringify(dateFilter));
                            // Add the date filter to the beginning of the pipeline
                            extractedPipeline.unshift({ $match: dateFilter });
                            console.log('Updated pipeline with date filter:', JSON.stringify(extractedPipeline));
                        }
                    }

                    return extractedPipeline;
                } catch (e) {
                    console.error('Error parsing extracted JSON:', e.message);
                }
            } else {
                console.log('No JSON array pattern found in content');
            }

            // If we couldn't extract a valid pipeline, use the generateFallbackPipeline method
            console.log('Failed to extract a valid pipeline, using fallback pipeline generator');
            return this.generateFallbackPipeline(query, collectionName);
        } catch (error) {
            console.error('Error extracting MongoDB pipeline:', error.message);
            console.log('Returning error pipeline...');
            return [
                { $match: { _id: "QUERY_GENERATION_FAILED" } },
                { $project: {
                    error: { $literal: "An error occurred while processing your query: " + error.message },
                    _id: 0
                }}
            ];
        }
    }

    // ... [rest of the class remains unchanged] ...
}

module.exports = new DeepSeekService();
