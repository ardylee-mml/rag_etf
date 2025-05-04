/**
 * Service to load and manage collection summaries
 */

const fs = require('fs').promises;
const path = require('path');

class CollectionSummaryService {
  constructor() {
    this.summaries = {};
    this.combinedSummary = null;
    this.summariesDir = path.join(__dirname, '../../data/collection-summaries');
    this.loaded = false;
  }

  /**
   * Load all collection summaries
   */
  async loadSummaries() {
    try {
      console.log('Loading collection summaries...');
      
      // Check if directory exists
      try {
        await fs.access(this.summariesDir);
      } catch (error) {
        console.log('Collection summaries directory not found, creating it...');
        await fs.mkdir(this.summariesDir, { recursive: true });
        this.loaded = true;
        return;
      }
      
      // Get all summary files
      const files = await fs.readdir(this.summariesDir);
      const summaryFiles = files.filter(file => file.endsWith('-summary.json'));
      
      // Load each summary file
      for (const file of summaryFiles) {
        if (file === 'combined-summary.json') continue;
        
        const filePath = path.join(this.summariesDir, file);
        const content = await fs.readFile(filePath, 'utf8');
        const summary = JSON.parse(content);
        
        const collectionName = summary.collectionName;
        this.summaries[collectionName] = summary;
        
        console.log(`Loaded summary for collection: ${collectionName}`);
      }
      
      // Load combined summary if available
      const combinedPath = path.join(this.summariesDir, 'combined-summary.json');
      try {
        const content = await fs.readFile(combinedPath, 'utf8');
        this.combinedSummary = JSON.parse(content);
        console.log('Loaded combined summary');
      } catch (error) {
        console.log('Combined summary not found');
      }
      
      this.loaded = true;
      console.log('All collection summaries loaded');
    } catch (error) {
      console.error('Error loading collection summaries:', error);
      this.loaded = false;
    }
  }

  /**
   * Get summary for a specific collection
   * @param {string} collectionName 
   * @returns {Object} Collection summary
   */
  getCollectionSummary(collectionName) {
    if (!this.loaded) {
      console.warn('Collection summaries not loaded');
      return null;
    }
    
    return this.summaries[collectionName] || null;
  }

  /**
   * Get all collection summaries
   * @returns {Object} All collection summaries
   */
  getAllSummaries() {
    if (!this.loaded) {
      console.warn('Collection summaries not loaded');
      return {};
    }
    
    return this.summaries;
  }

  /**
   * Get combined summary
   * @returns {Object} Combined summary
   */
  getCombinedSummary() {
    if (!this.loaded) {
      console.warn('Collection summaries not loaded');
      return null;
    }
    
    return this.combinedSummary;
  }

  /**
   * Get example queries for a collection
   * @param {string} collectionName 
   * @returns {Array} Example queries
   */
  getExampleQueries(collectionName) {
    const summary = this.getCollectionSummary(collectionName);
    if (!summary) return [];
    
    return summary.exampleQueries || [];
  }

  /**
   * Get relationships for a collection
   * @param {string} collectionName 
   * @returns {Object} Relationships
   */
  getRelationships(collectionName) {
    const summary = this.getCollectionSummary(collectionName);
    if (!summary) return { outgoing: [], incoming: [] };
    
    return {
      outgoing: summary.outgoingRelationships || [],
      incoming: summary.incomingRelationships || []
    };
  }

  /**
   * Format collection summary for LLM prompt
   * @param {string} collectionName 
   * @returns {string} Formatted summary
   */
  formatSummaryForPrompt(collectionName) {
    const summary = this.getCollectionSummary(collectionName);
    if (!summary) return '';
    
    let formatted = `Collection: ${collectionName}\n`;
    formatted += `Description: ${summary.description}\n`;
    formatted += `Document Count: ${summary.documentCount}\n`;
    formatted += `ID Type: ${summary.idType}\n\n`;
    
    // Key fields
    formatted += 'Key Fields:\n';
    for (const field of summary.keyFields) {
      const fieldInfo = summary.fields.find(f => f.path === field);
      if (fieldInfo) {
        formatted += `- ${field} (${fieldInfo.types.join('|')})`;
        if (fieldInfo.description) {
          formatted += `: ${fieldInfo.description}`;
        }
        formatted += '\n';
      } else {
        formatted += `- ${field}\n`;
      }
    }
    formatted += '\n';
    
    // Relationships
    if (summary.outgoingRelationships.length > 0) {
      formatted += 'Relationships (outgoing):\n';
      for (const rel of summary.outgoingRelationships) {
        formatted += `- ${collectionName}.${rel.sourceField} → ${rel.targetCollection}.${rel.targetField} (confidence: ${Math.round(rel.confidence * 100)}%)\n`;
      }
      formatted += '\n';
    }
    
    if (summary.incomingRelationships.length > 0) {
      formatted += 'Relationships (incoming):\n';
      for (const rel of summary.incomingRelationships) {
        formatted += `- ${rel.sourceCollection}.${rel.sourceField} → ${collectionName}.${rel.targetField} (confidence: ${Math.round(rel.confidence * 100)}%)\n`;
      }
      formatted += '\n';
    }
    
    // Example queries
    if (summary.exampleQueries && summary.exampleQueries.length > 0) {
      formatted += 'Example Queries:\n';
      for (const query of summary.exampleQueries) {
        formatted += `- Question: "${query.question}"\n`;
        formatted += `  Pipeline: ${JSON.stringify(query.pipeline)}\n\n`;
      }
    }
    
    return formatted;
  }

  /**
   * Get relevant summaries for a query
   * @param {string} query 
   * @param {string} primaryCollection 
   * @returns {string} Formatted summaries
   */
  getRelevantSummariesForQuery(query, primaryCollection) {
    if (!this.loaded) {
      console.warn('Collection summaries not loaded');
      return '';
    }
    
    // Always include the primary collection
    let relevantCollections = [primaryCollection];
    
    // Check for keywords that might indicate other collections
    const lowerQuery = query.toLowerCase();
    
    if (lowerQuery.includes('player') || lowerQuery.includes('user')) {
      relevantCollections.push('players');
    }
    
    if (lowerQuery.includes('question') || lowerQuery.includes('answer') || lowerQuery.includes('quiz')) {
      relevantCollections.push('questions');
    }
    
    if (lowerQuery.includes('item') || lowerQuery.includes('object') || lowerQuery.includes('collect')) {
      relevantCollections.push('items');
    }
    
    if (lowerQuery.includes('zone') || lowerQuery.includes('area') || lowerQuery.includes('location')) {
      relevantCollections.push('zones');
    }
    
    if (lowerQuery.includes('score') || lowerQuery.includes('leaderboard') || lowerQuery.includes('ranking')) {
      relevantCollections.push('leaderboards');
    }
    
    if (lowerQuery.includes('event') || lowerQuery.includes('activity') || 
        lowerQuery.includes('played') || lowerQuery.includes('time')) {
      relevantCollections.push('events');
    }
    
    // Remove duplicates
    relevantCollections = [...new Set(relevantCollections)];
    
    // Format summaries
    let formatted = 'Collection Summaries:\n\n';
    
    for (const collection of relevantCollections) {
      const summary = this.formatSummaryForPrompt(collection);
      if (summary) {
        formatted += summary + '\n---\n\n';
      }
    }
    
    return formatted;
  }
}

module.exports = new CollectionSummaryService();
