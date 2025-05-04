/**
 * Self-Learning Schema Analysis and Query Generation System
 * 
 * Main entry point for the self-learning system.
 */
const { runSelfLearning } = require('./self-learning');
const SelfLearningIntegration = require('./integration');
const { analyzeSchema, analyzeCollectionSchema } = require('./schema-analyzer');
const { discoverRelationships } = require('./relationship-discoverer');
const { generateQueryPatterns } = require('./query-pattern-generator');
const { generateQuestions } = require('./question-generator');
const { executeQuery, executeQueryPattern } = require('./query-executor');

module.exports = {
  runSelfLearning,
  SelfLearningIntegration,
  analyzeSchema,
  analyzeCollectionSchema,
  discoverRelationships,
  generateQueryPatterns,
  generateQuestions,
  executeQuery,
  executeQueryPattern
};
