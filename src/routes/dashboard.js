/**
 * Dashboard API Routes
 * 
 * Provides API endpoints for the dashboard
 */
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises;
const mongoose = require('mongoose');

// Helper function to safely read a JSON file
async function safeReadJsonFile(filePath) {
    try {
        const fileExists = await fs.access(filePath).then(() => true).catch(() => false);
        if (!fileExists) {
            console.warn(`File does not exist: ${filePath}`);
            return null;
        }
        
        const data = await fs.readFile(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.warn(`Error reading file ${filePath}:`, error.message);
        return null;
    }
}

// Helper function to ensure directory exists
async function ensureDirectoryExists(dirPath) {
    try {
        await fs.access(dirPath);
    } catch (error) {
        // Directory doesn't exist, create it
        console.log(`Creating directory: ${dirPath}`);
        await fs.mkdir(dirPath, { recursive: true });
    }
}

// Get dashboard data
router.get('/data', async (req, res) => {
    try {
        console.log('Dashboard data endpoint called');
        
        // Default data
        const defaultData = {
            summary: {
                totalCollections: 5,
                totalRelationships: 3,
                totalQueryPatterns: 10,
                totalQuestions: 20,
                successfulQueries: 15,
                failedQueries: 3,
                timeoutQueries: 2,
                optimizedQueries: 8,
                lastRunTimestamp: new Date(),
                collections: 5,
                relationships: 3,
                queryPatterns: 10,
                questions: 20,
                lastUpdated: new Date()
            },
            relationships: [
                {
                    source: { collection: 'players', field: '_id' },
                    target: { collection: 'events', field: 'playerId' },
                    description: 'Players to Events relationship',
                    confidence: 0.95
                },
                {
                    source: { collection: 'events', field: 'context.questionId' },
                    target: { collection: 'questions', field: '_id' },
                    description: 'Events to Questions relationship',
                    confidence: 0.9
                },
                {
                    source: { collection: 'events', field: 'context.zoneId' },
                    target: { collection: 'zones', field: '_id' },
                    description: 'Events to Zones relationship',
                    confidence: 0.85
                }
            ],
            queryPatterns: [
                {
                    id: 'avg_attempts_per_question',
                    description: 'Average attempts per question',
                    collections: ['events', 'questions'],
                    complexity: 'advanced',
                    category: 'performance',
                    mongoQuery: {
                        pipeline: [
                            { $match: { type: 'question' } },
                            { $group: {
                                _id: {
                                    playerId: '$playerId',
                                    questionId: '$context.questionId'
                                },
                                count: { $sum: 1 }
                              }
                            },
                            { $group: {
                                _id: '$_id.questionId',
                                avgAttempts: { $avg: '$count' }
                              }
                            }
                        ]
                    }
                },
                {
                    id: 'player_activity',
                    description: 'Player activity over time',
                    collections: ['players', 'events'],
                    complexity: 'medium',
                    category: 'engagement',
                    mongoQuery: {
                        pipeline: [
                            { $match: { type: 'signin' } },
                            { $group: {
                                _id: {
                                    playerId: '$playerId',
                                    day: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } }
                                },
                                count: { $sum: 1 }
                              }
                            }
                        ]
                    }
                },
                {
                    id: 'average_play_time',
                    description: 'Average play time for players based on signin/signout events',
                    collections: ['events'],
                    complexity: 'advanced',
                    category: 'engagement',
                    mongoQuery: {
                        pipeline: [
                            { $match: { type: { $in: ['signin', 'signout'] } } },
                            { $sort: { playerId: 1, time: 1 } },
                            { $group: {
                                _id: '$playerId',
                                events: { 
                                  $push: { 
                                    type: '$type', 
                                    time: '$time' 
                                  } 
                                }
                              }
                            }
                        ]
                    }
                }
            ],
            questions: [
                {
                    id: 'q1',
                    text: 'What is the average number of attempts per question?',
                    collections: ['events', 'questions'],
                    intent: 'analysis',
                    category: 'performance',
                    queryPattern: 'avg_attempts_per_question',
                    execution: {
                        success: true,
                        executionTime: 120,
                        resultCount: 15
                    }
                },
                {
                    id: 'q2',
                    text: 'How many players signed in each day?',
                    collections: ['players', 'events'],
                    intent: 'analysis',
                    category: 'engagement',
                    queryPattern: 'player_activity',
                    execution: {
                        success: true,
                        executionTime: 85,
                        resultCount: 30
                    }
                },
                {
                    id: 'q3',
                    text: 'What is the average play time of players?',
                    collections: ['events'],
                    intent: 'analysis',
                    category: 'engagement',
                    queryPattern: 'average_play_time',
                    execution: {
                        success: true,
                        executionTime: 150,
                        resultCount: 1
                    }
                }
            ],
            stats: {
                successfulQueries: 15,
                failedQueries: 3,
                averageExecutionTime: 102.5
            }
        };

        // Try to load data from files
        try {
            const dataDir = path.join(__dirname, '..', '..', 'data', 'self-learning');
            
            // Ensure the data directory exists
            await ensureDirectoryExists(dataDir);
            
            // Load summary
            const summaryPath = path.join(dataDir, 'summary.json');
            const summaryData = await safeReadJsonFile(summaryPath);
            if (summaryData) {
                defaultData.summary = { ...summaryData, lastUpdated: new Date() };
            }
            
            // Load relationships
            const relationshipsPath = path.join(dataDir, 'relationships.json');
            const relationshipsData = await safeReadJsonFile(relationshipsPath);
            if (relationshipsData) {
                defaultData.relationships = relationshipsData;
            }
            
            // Load query patterns
            const queryPatternsPath = path.join(dataDir, 'query-patterns.json');
            const queryPatternsData = await safeReadJsonFile(queryPatternsPath);
            if (queryPatternsData) {
                defaultData.queryPatterns = queryPatternsData;
            }
            
            // Load questions
            const questionsPath = path.join(dataDir, 'validated-questions.json');
            const questionsData = await safeReadJsonFile(questionsPath);
            if (questionsData) {
                defaultData.questions = questionsData;
            }
            
            console.log('Loaded data from files');
        } catch (error) {
            console.warn('Error loading data from files:', error);
            console.log('Using default data');
        }

        // Get real collection information from MongoDB
        try {
            if (mongoose.connection.readyState === 1) { // Connected
                const db = mongoose.connection.db;
                const collections = await db.listCollections().toArray();
                
                // Update collection count in summary
                defaultData.summary.totalCollections = collections.length;
                defaultData.summary.collections = collections.length;
                
                console.log(`Updated collection count from MongoDB: ${collections.length}`);
            }
        } catch (mongoError) {
            console.warn('Error getting MongoDB collections:', mongoError);
        }

        res.json(defaultData);
    } catch (error) {
        console.error('Error getting dashboard data:', error);
        res.status(500).json({
            error: 'Error getting dashboard data',
            message: error.message
        });
    }
});

module.exports = router;
