/**
 * Self-Learning Service
 *
 * Provides integration between the main system and the Self-Learning
 * Schema Analysis and Query Generation System.
 */
const SelfLearningIntegration = require('../self-learning/integration');
const { runSelfLearning } = require('../self-learning');
const path = require('path');
const fs = require('fs').promises;

class SelfLearningService {
  constructor() {
    this.integration = new SelfLearningIntegration({
      dataDir: path.join(__dirname, '..', '..', 'data', 'self-learning'),
      cacheResults: true,
      refreshInterval: 24 * 60 * 60 * 1000 // 24 hours
    });

    this.initialized = false;
    this.lastRunTimestamp = null;
  }

  /**
   * Initializes the self-learning service
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.initialized) return;

    try {
      console.log('Initializing self-learning service...');

      // Check if self-learning data exists
      const dataExists = await this.checkDataExists();

      if (!dataExists) {
        console.log('Self-learning data not found, running self-learning process...');
        await this.runSelfLearning();
      }

      // Initialize the integration
      await this.integration.initialize();

      this.initialized = true;
      console.log('Self-learning service initialized successfully');
    } catch (error) {
      console.error('Error initializing self-learning service:', error);
      // Continue without self-learning
      console.log('Continuing without self-learning service');
    }
  }

  /**
   * Checks if self-learning data exists
   * @returns {Promise<boolean>}
   */
  async checkDataExists() {
    try {
      const dataDir = path.join(__dirname, '..', '..', 'data', 'self-learning');

      // Check if directory exists
      try {
        await fs.access(dataDir);
      } catch (error) {
        return false;
      }

      // Check if summary file exists
      try {
        await fs.access(path.join(dataDir, 'summary.json'));
        return true;
      } catch (error) {
        return false;
      }
    } catch (error) {
      console.error('Error checking if self-learning data exists:', error);
      return false;
    }
  }

  /**
   * Runs the self-learning process
   * @param {Object} options Options for the self-learning process
   * @returns {Promise<void>}
   */
  async runSelfLearning(options = {}) {
    try {
      console.log('Running self-learning process...');

      // Create data directory if it doesn't exist
      const dataDir = path.join(__dirname, '..', '..', 'data', 'self-learning');
      await fs.mkdir(dataDir, { recursive: true });

      // Default options for self-learning
      const defaultOptions = {
        outputDir: dataDir,
        validateQueries: true,
        sampleSize: 10,
        maxTimeMS: 10000, // 10 seconds timeout for queries
        skipLargeCollections: false, // Set to false to attempt all collections
        maxQueryRetries: 2 // Number of times to retry a failed query
      };

      // Run self-learning process with combined options
      await runSelfLearning({
        ...defaultOptions,
        ...options
      });

      this.lastRunTimestamp = new Date();
      console.log('Self-learning process completed successfully');

      // Reload the integration data
      await this.integration.loadData();
    } catch (error) {
      console.error('Error running self-learning process:', error);
      throw error;
    }
  }

  /**
   * Gets schema information for a collection
   * @param {String} collectionName Collection name
   * @returns {Object|null} Schema information for the collection
   */
  getCollectionSchema(collectionName) {
    if (!this.initialized) return null;
    return this.integration.getCollectionSchema(collectionName);
  }

  /**
   * Gets all schema information
   * @returns {Object|null} All schema information
   */
  getAllSchemaInfo() {
    if (!this.initialized) return null;
    return this.integration.getAllSchemaInfo();
  }

  /**
   * Gets relationships for a collection
   * @param {String} collectionName Collection name
   * @returns {Array} Relationships for the collection
   */
  getCollectionRelationships(collectionName) {
    if (!this.initialized) return [];
    return this.integration.getCollectionRelationships(collectionName);
  }

  /**
   * Gets relationship between two collections
   * @param {String} sourceCollection Source collection name
   * @param {String} targetCollection Target collection name
   * @returns {Object|null} Relationship between the collections
   */
  getRelationship(sourceCollection, targetCollection) {
    if (!this.initialized) return null;
    return this.integration.getRelationship(sourceCollection, targetCollection);
  }

  /**
   * Gets query patterns for a collection
   * @param {String} collectionName Collection name
   * @returns {Array} Query patterns for the collection
   */
  getCollectionQueryPatterns(collectionName) {
    if (!this.initialized) return [];
    return this.integration.getCollectionQueryPatterns(collectionName);
  }

  /**
   * Gets a query pattern for a natural language query
   * @param {String} query Natural language query
   * @param {Object} options Options for query pattern selection
   * @returns {Object|null} Query pattern for the query
   */
  getQueryPatternForQuery(query, options = {}) {
    if (!this.initialized) return null;
    return this.integration.getQueryPatternForQuery(query, options);
  }

  /**
   * Generates a MongoDB query for a natural language query
   * @param {String} query Natural language query
   * @param {String} collectionName Collection name
   * @param {Object} options Query generation options
   * @returns {Object|null} Generated MongoDB query
   */
  generateMongoDBQuery(query, collectionName, options = {}) {
    if (!this.initialized) return null;

    // Set collection-specific options
    const queryOptions = {
      ...options,
      collection: collectionName
    };

    return this.integration.generateMongoDBQuery(query, queryOptions);
  }

  /**
   * Enhances a query with self-learning information
   * @param {Object} query Query object
   * @param {Object} options Enhancement options
   * @returns {Object} Enhanced query
   */
  enhanceQuery(query, options = {}) {
    if (!this.initialized) return query;
    return this.integration.enhanceQuery(query, options);
  }

  /**
   * Gets summary information
   * @returns {Object|null} Summary information
   */
  getSummary() {
    if (!this.initialized) return null;
    return this.integration.getSummary();
  }

  /**
   * Finds the most similar question to a given query
   * @param {String} query User query
   * @param {Number} threshold Similarity threshold (0-1)
   * @returns {Object|null} Most similar question
   */
  findSimilarQuestion(query, threshold = 0.7) {
    if (!this.initialized) return null;
    return this.integration.findSimilarQuestion(query, threshold);
  }

  /**
   * Gets all relationships
   * @returns {Array} All relationships
   */
  getAllRelationships() {
    if (!this.initialized) return [];
    return this.integration.getAllRelationships();
  }

  /**
   * Gets all query patterns
   * @returns {Array} All query patterns
   */
  getAllQueryPatterns() {
    if (!this.initialized) return [];
    return this.integration.getAllQueryPatterns();
  }

  /**
   * Gets all questions
   * @returns {Array} All questions
   */
  getAllQuestions() {
    if (!this.initialized) return [];
    return this.integration.getAllQuestions();
  }

  /**
   * Cleans up resources
   */
  cleanup() {
    if (this.integration) {
      this.integration.cleanup();
    }
  }
}

module.exports = new SelfLearningService();
