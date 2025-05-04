/**
 * Self-Learning Integration Module
 * 
 * Provides integration between the self-learning system and the main system.
 * Allows the main system to use the results of the self-learning process
 * to improve query generation and understanding.
 */
const fs = require('fs').promises;
const path = require('path');

/**
 * Self-Learning Integration class
 */
class SelfLearningIntegration {
  /**
   * Constructor
   * @param {Object} options Configuration options
   */
  constructor(options = {}) {
    this.defaultOptions = {
      dataDir: path.join(__dirname, '..', '..', 'data', 'self-learning'),
      cacheResults: true,
      refreshInterval: 24 * 60 * 60 * 1000 // 24 hours
    };
    
    this.options = { ...this.defaultOptions, ...options };
    this.data = {
      schemaInfo: null,
      relationships: null,
      queryPatterns: null,
      questions: null,
      summary: null,
      lastLoaded: null
    };
  }
  
  /**
   * Initializes the integration
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      console.log('Initializing self-learning integration...');
      await this.loadData();
      
      // Set up automatic refresh if enabled
      if (this.options.refreshInterval > 0) {
        this.refreshTimer = setInterval(() => {
          this.loadData().catch(err => {
            console.error('Error refreshing self-learning data:', err);
          });
        }, this.options.refreshInterval);
      }
      
      console.log('Self-learning integration initialized successfully');
    } catch (error) {
      console.error('Error initializing self-learning integration:', error);
      throw error;
    }
  }
  
  /**
   * Loads data from the self-learning output files
   * @returns {Promise<void>}
   */
  async loadData() {
    try {
      const dataDir = this.options.dataDir;
      
      // Check if data directory exists
      try {
        await fs.access(dataDir);
      } catch (error) {
        console.warn(`Self-learning data directory not found: ${dataDir}`);
        return;
      }
      
      // Load schema info
      try {
        const schemaInfoPath = path.join(dataDir, 'schema-info.json');
        const schemaInfoData = await fs.readFile(schemaInfoPath, 'utf8');
        this.data.schemaInfo = JSON.parse(schemaInfoData);
      } catch (error) {
        console.warn('Error loading schema info:', error);
      }
      
      // Load relationships
      try {
        const relationshipsPath = path.join(dataDir, 'relationships.json');
        const relationshipsData = await fs.readFile(relationshipsPath, 'utf8');
        this.data.relationships = JSON.parse(relationshipsData);
      } catch (error) {
        console.warn('Error loading relationships:', error);
      }
      
      // Load query patterns
      try {
        const queryPatternsPath = path.join(dataDir, 'query-patterns.json');
        const queryPatternsData = await fs.readFile(queryPatternsPath, 'utf8');
        this.data.queryPatterns = JSON.parse(queryPatternsData);
      } catch (error) {
        console.warn('Error loading query patterns:', error);
      }
      
      // Load validated questions
      try {
        const questionsPath = path.join(dataDir, 'validated-questions.json');
        const questionsData = await fs.readFile(questionsPath, 'utf8');
        this.data.questions = JSON.parse(questionsData);
      } catch (error) {
        console.warn('Error loading validated questions:', error);
      }
      
      // Load summary
      try {
        const summaryPath = path.join(dataDir, 'summary.json');
        const summaryData = await fs.readFile(summaryPath, 'utf8');
        this.data.summary = JSON.parse(summaryData);
      } catch (error) {
        console.warn('Error loading summary:', error);
      }
      
      this.data.lastLoaded = new Date();
      console.log('Self-learning data loaded successfully');
    } catch (error) {
      console.error('Error loading self-learning data:', error);
      throw error;
    }
  }
  
  /**
   * Gets schema information for a collection
   * @param {String} collectionName Collection name
   * @returns {Object|null} Schema information for the collection
   */
  getCollectionSchema(collectionName) {
    if (!this.data.schemaInfo) return null;
    return this.data.schemaInfo[collectionName] || null;
  }
  
  /**
   * Gets all schema information
   * @returns {Object|null} All schema information
   */
  getAllSchemaInfo() {
    return this.data.schemaInfo;
  }
  
  /**
   * Gets relationships for a collection
   * @param {String} collectionName Collection name
   * @returns {Array} Relationships for the collection
   */
  getCollectionRelationships(collectionName) {
    if (!this.data.relationships) return [];
    
    return this.data.relationships.filter(rel => 
      rel.source.collection === collectionName || 
      rel.target.collection === collectionName
    );
  }
  
  /**
   * Gets all relationships
   * @returns {Array|null} All relationships
   */
  getAllRelationships() {
    return this.data.relationships;
  }
  
  /**
   * Gets relationship between two collections
   * @param {String} sourceCollection Source collection name
   * @param {String} targetCollection Target collection name
   * @returns {Object|null} Relationship between the collections
   */
  getRelationship(sourceCollection, targetCollection) {
    if (!this.data.relationships) return null;
    
    return this.data.relationships.find(rel => 
      (rel.source.collection === sourceCollection && rel.target.collection === targetCollection) ||
      (rel.source.collection === targetCollection && rel.target.collection === sourceCollection)
    ) || null;
  }
  
  /**
   * Gets query patterns for a collection
   * @param {String} collectionName Collection name
   * @returns {Array} Query patterns for the collection
   */
  getCollectionQueryPatterns(collectionName) {
    if (!this.data.queryPatterns) return [];
    
    return this.data.queryPatterns.filter(pattern => 
      pattern.collection === collectionName || 
      (pattern.collections && pattern.collections.includes(collectionName))
    );
  }
  
  /**
   * Gets all query patterns
   * @returns {Array|null} All query patterns
   */
  getAllQueryPatterns() {
    return this.data.queryPatterns;
  }
  
  /**
   * Gets query pattern by ID
   * @param {String} patternId Pattern ID
   * @returns {Object|null} Query pattern
   */
  getQueryPattern(patternId) {
    if (!this.data.queryPatterns) return null;
    return this.data.queryPatterns.find(pattern => pattern.id === patternId) || null;
  }
  
  /**
   * Gets questions for a collection
   * @param {String} collectionName Collection name
   * @returns {Array} Questions for the collection
   */
  getCollectionQuestions(collectionName) {
    if (!this.data.questions) return [];
    
    return this.data.questions.filter(question => 
      question.collections && question.collections.includes(collectionName)
    );
  }
  
  /**
   * Gets all questions
   * @returns {Array|null} All questions
   */
  getAllQuestions() {
    return this.data.questions;
  }
  
  /**
   * Gets questions by intent
   * @param {String} intent Question intent
   * @returns {Array} Questions with the specified intent
   */
  getQuestionsByIntent(intent) {
    if (!this.data.questions) return [];
    return this.data.questions.filter(question => question.intent === intent);
  }
  
  /**
   * Gets questions by category
   * @param {String} category Question category
   * @returns {Array} Questions with the specified category
   */
  getQuestionsByCategory(category) {
    if (!this.data.questions) return [];
    return this.data.questions.filter(question => question.category === category);
  }
  
  /**
   * Gets summary information
   * @returns {Object|null} Summary information
   */
  getSummary() {
    return this.data.summary;
  }
  
  /**
   * Finds the most similar question to a given query
   * @param {String} query User query
   * @param {Number} threshold Similarity threshold (0-1)
   * @returns {Object|null} Most similar question
   */
  findSimilarQuestion(query, threshold = 0.7) {
    if (!this.data.questions || !query) return null;
    
    // Simple similarity calculation based on word overlap
    const queryWords = new Set(query.toLowerCase().split(/\s+/).filter(w => w.length > 2));
    
    let bestMatch = null;
    let bestScore = 0;
    
    for (const question of this.data.questions) {
      if (!question.text) continue;
      
      const questionWords = new Set(question.text.toLowerCase().split(/\s+/).filter(w => w.length > 2));
      
      // Calculate Jaccard similarity
      const intersection = new Set([...queryWords].filter(word => questionWords.has(word)));
      const union = new Set([...queryWords, ...questionWords]);
      
      const similarity = intersection.size / union.size;
      
      if (similarity > bestScore) {
        bestScore = similarity;
        bestMatch = question;
      }
    }
    
    return bestScore >= threshold ? { ...bestMatch, similarity: bestScore } : null;
  }
  
  /**
   * Gets a query pattern for a natural language query
   * @param {String} query Natural language query
   * @param {Object} options Options for query pattern selection
   * @returns {Object|null} Query pattern for the query
   */
  getQueryPatternForQuery(query, options = {}) {
    const similarQuestion = this.findSimilarQuestion(query, options.threshold || 0.7);
    
    if (similarQuestion && similarQuestion.queryPattern) {
      return {
        pattern: similarQuestion.queryPattern,
        matchedQuestion: similarQuestion,
        confidence: similarQuestion.similarity
      };
    }
    
    return null;
  }
  
  /**
   * Enhances a query with self-learning information
   * @param {Object} query Query object
   * @param {Object} options Enhancement options
   * @returns {Object} Enhanced query
   */
  enhanceQuery(query, options = {}) {
    // Add schema information
    if (query.collection && this.data.schemaInfo && this.data.schemaInfo[query.collection]) {
      query.schemaInfo = this.data.schemaInfo[query.collection];
    }
    
    // Add relationship information
    if (query.collection && query.relatedCollection) {
      const relationship = this.getRelationship(query.collection, query.relatedCollection);
      if (relationship) {
        query.relationshipInfo = relationship;
      }
    }
    
    return query;
  }
  
  /**
   * Generates a MongoDB query for a natural language query
   * @param {String} query Natural language query
   * @param {Object} options Query generation options
   * @returns {Object|null} Generated MongoDB query
   */
  generateMongoDBQuery(query, options = {}) {
    const patternInfo = this.getQueryPatternForQuery(query, options);
    
    if (patternInfo && patternInfo.pattern && patternInfo.pattern.mongoQuery) {
      return {
        ...patternInfo.pattern.mongoQuery,
        confidence: patternInfo.confidence,
        matchedQuestion: patternInfo.matchedQuestion.text,
        explanation: `Query generated based on pattern: ${patternInfo.pattern.description}`
      };
    }
    
    return null;
  }
  
  /**
   * Cleans up resources
   */
  cleanup() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }
}

module.exports = SelfLearningIntegration;
