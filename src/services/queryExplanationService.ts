import { QueryExplanation } from '../models/QueryExplanation';
import mongoose from 'mongoose';
import stringSimilarity from 'string-similarity';

class QueryExplanationService {
  private commonQueryPatterns = [
    { pattern: /find|search|get|retrieve/i, intent: 'READ' },
    { pattern: /count|sum|average|mean/i, intent: 'AGGREGATE' },
    { pattern: /update|modify|change/i, intent: 'UPDATE' },
    { pattern: /delete|remove/i, intent: 'DELETE' },
    { pattern: /create|insert|add/i, intent: 'CREATE' }
  ];

  async explainQuery(naturalQuery: string, mongoQuery: any, collection: string): Promise<any> {
    const queryId = new mongoose.Types.ObjectId().toString();
    const interpretation = await this.interpretQuery(naturalQuery);
    const execution = await this.analyzeExecution(mongoQuery, collection);
    const suggestions = await this.generateSuggestions(naturalQuery, mongoQuery, collection);

    const explanation = await QueryExplanation.create({
      queryId,
      originalQuery: {
        text: naturalQuery,
        timestamp: new Date()
      },
      interpretation,
      execution,
      suggestions,
      metadata: {
        collection,
        duration: 0,
        status: 'analyzed'
      }
    });

    return explanation;
  }

  private async interpretQuery(query: string) {
    // Detect intent
    const intent = this.detectQueryIntent(query);
    
    // Extract entities
    const entities = this.extractEntities(query);
    
    // Identify conditions
    const conditions = this.identifyConditions(query);
    
    // Calculate confidence
    const confidence = this.calculateConfidence(query, intent, entities);

    return {
      intent,
      entities,
      conditions,
      confidence
    };
  }

  private async analyzeExecution(mongoQuery: any, collection: string) {
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection not established');
    }
    
    // Get collection stats and indexes
    const collStats = await db.command({ collStats: collection });
    const indexes = await db.collection(collection).indexes();
    
    // Analyze query plan
    const explainOutput = await db.collection(collection)
      .find(mongoQuery)
      .explain('executionStats');

    const usedIndexes = this.analyzeUsedIndexes(explainOutput, indexes);
    const complexity = this.estimateComplexity(explainOutput, collStats);

    return {
      usedIndexes,
      estimatedComplexity: complexity,
      executionStats: explainOutput.executionStats
    };
  }

  private async generateSuggestions(naturalQuery: string, mongoQuery: any, collection: string) {
    const alternativePhrasing = await this.generateAlternativePhrasing(naturalQuery);
    const optimizationTips = await this.generateOptimizationTips(mongoQuery);
    const recommendedIndexes = await this.suggestIndexes(mongoQuery, collection);

    return {
      alternativePhrasing,
      optimizationTips,
      recommendedIndexes
    };
  }

  private detectQueryIntent(query: string): string {
    for (const { pattern, intent } of this.commonQueryPatterns) {
      if (pattern.test(query)) {
        return intent;
      }
    }
    return 'UNKNOWN';
  }

  private extractEntities(query: string): Array<{ name: string; value: string; type: string }> {
    const entities: Array<{ name: string; value: string; type: string }> = [];
    
    // Extract dates
    const datePattern = /(\d{4}-\d{2}-\d{2})|(\d{1,2}\/\d{1,2}\/\d{4})/g;
    const dates = query.match(datePattern) || [];
    dates.forEach(date => {
      entities.push({ name: 'date', value: date, type: 'DATE' });
    });

    // Extract numbers
    const numberPattern = /\b\d+(\.\d+)?\b/g;
    const numbers = query.match(numberPattern) || [];
    numbers.forEach(num => {
      entities.push({ name: 'number', value: num, type: 'NUMBER' });
    });

    // Extract quoted strings
    const stringPattern = /"([^"]+)"|'([^']+)'/g;
    const strings = query.match(stringPattern) || [];
    strings.forEach(str => {
      entities.push({ name: 'string', value: str.slice(1, -1), type: 'STRING' });
    });

    return entities;
  }

  private identifyConditions(query: string): string[] {
    const conditions: string[] = [];
    const conditionPatterns = [
      { pattern: /greater than|more than|over|above/i, condition: 'GREATER_THAN' },
      { pattern: /less than|under|below/i, condition: 'LESS_THAN' },
      { pattern: /equal to|exactly|precisely/i, condition: 'EQUALS' },
      { pattern: /between/i, condition: 'BETWEEN' },
      { pattern: /not|except|exclude/i, condition: 'NOT' }
    ];

    conditionPatterns.forEach(({ pattern, condition }) => {
      if (pattern.test(query)) {
        conditions.push(condition);
      }
    });

    return conditions;
  }

  private calculateConfidence(query: string, intent: string, entities: any[]): number {
    let confidence = 0.5; // Base confidence

    // Adjust based on intent clarity
    if (intent !== 'UNKNOWN') confidence += 0.2;

    // Adjust based on entity recognition
    if (entities.length > 0) confidence += 0.1 * Math.min(entities.length, 3);

    // Adjust based on query length (penalize very short queries)
    if (query.length < 5) confidence -= 0.2;

    // Cap at 1.0
    return Math.min(confidence, 1.0);
  }

  private analyzeUsedIndexes(explainOutput: any, availableIndexes: any[]): any[] {
    const usedIndexes: Array<{ name: string; field: any; type: string; efficiency: number }> = [];
    const stage = explainOutput.queryPlanner.winningPlan;

    // Recursively analyze query plan stages
    const analyzeStage = (stage: any) => {
      if (stage.inputStage) {
        analyzeStage(stage.inputStage);
      }

      if (stage.indexName) {
        const index = availableIndexes.find(idx => idx.name === stage.indexName);
        if (index) {
          usedIndexes.push({
            name: stage.indexName,
            field: index.key,
            type: this.getIndexType(index),
            efficiency: this.calculateIndexEfficiency(stage)
          });
        }
      }
    };

    analyzeStage(stage);
    return usedIndexes;
  }

  private getIndexType(index: any): string {
    if (index.unique) return 'UNIQUE';
    if (index.sparse) return 'SPARSE';
    if (index.background) return 'BACKGROUND';
    return 'STANDARD';
  }

  private calculateIndexEfficiency(stage: any): number {
    if (!stage.executionStats) return 0;

    const docsExamined = stage.executionStats.totalDocsExamined;
    const nReturned = stage.executionStats.nReturned;

    if (docsExamined === 0) return 1;
    return Math.min(nReturned / docsExamined, 1);
  }

  private estimateComplexity(explainOutput: any, collStats: any): any {
    const stats = explainOutput.executionStats;
    const totalDocs = collStats.count;

    let timeComplexity = 'O(n)';
    if (stats.totalDocsExamined === 0) {
      timeComplexity = 'O(1)';
    } else if (stats.totalDocsExamined < totalDocs) {
      timeComplexity = 'O(log n)';
    }

    return {
      timeComplexity,
      documentsExamined: stats.totalDocsExamined,
      indexesUsed: stats.nReturned
    };
  }

  private async generateAlternativePhrasing(query: string): Promise<string[]> {
    const alternatives = [];
    const similarQueries = await this.findSimilarSuccessfulQueries(query);
    
    // Add successful similar queries as alternatives
    alternatives.push(...similarQueries.map(q => q.originalQuery.text));

    // Generate structural alternatives
    if (query.includes('greater than')) {
      alternatives.push(query.replace('greater than', 'more than'));
    }
    if (query.includes('less than')) {
      alternatives.push(query.replace('less than', 'under'));
    }

    return [...new Set(alternatives)].slice(0, 3); // Return unique alternatives, max 3
  }

  private async findSimilarSuccessfulQueries(query: string): Promise<any[]> {
    const recentQueries = await QueryExplanation.find({
      'metadata.status': 'success'
    })
    .sort({ 'originalQuery.timestamp': -1 })
    .limit(100)
    .lean();

    return recentQueries
      .filter(q => q.originalQuery?.text)
      .map(q => ({
        ...q,
        similarity: stringSimilarity.compareTwoStrings(query, q.originalQuery!.text as string)
      }))
      .filter(q => q.similarity > 0.6)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 3);
  }

  private async generateOptimizationTips(mongoQuery: any): Promise<string[]> {
    const tips = [];

    // Check for full collection scans
    if (this.isFullCollectionScan(mongoQuery)) {
      tips.push('Consider adding an index to avoid full collection scan');
    }

    // Check for inefficient regex
    if (this.hasIneffientRegex(mongoQuery)) {
      tips.push('Use anchored regex patterns (^) for better performance');
    }

    // Check for large in/nin arrays
    if (this.hasLargeInArray(mongoQuery)) {
      tips.push('Consider breaking large $in/$nin queries into smaller batches');
    }

    return tips;
  }

  private isFullCollectionScan(mongoQuery: any): boolean {
    return Object.keys(mongoQuery).length === 0 || 
           (Object.keys(mongoQuery).length === 1 && mongoQuery.$query);
  }

  private hasIneffientRegex(mongoQuery: any): boolean {
    const hasUnanchoredRegex = (obj: any): boolean => {
      for (const key in obj) {
        if (typeof obj[key] === 'object') {
          if (hasUnanchoredRegex(obj[key])) return true;
        } else if (obj[key] instanceof RegExp && !obj[key].source.startsWith('^')) {
          return true;
        }
      }
      return false;
    };

    return hasUnanchoredRegex(mongoQuery);
  }

  private hasLargeInArray(mongoQuery: any): boolean {
    const hasLargeIn = (obj: any): boolean => {
      for (const key in obj) {
        if (typeof obj[key] === 'object') {
          if (obj[key].$in && obj[key].$in.length > 50) return true;
          if (obj[key].$nin && obj[key].$nin.length > 50) return true;
          if (hasLargeIn(obj[key])) return true;
        }
      }
      return false;
    };

    return hasLargeIn(mongoQuery);
  }

  private async suggestIndexes(mongoQuery: any, collection: string): Promise<any[]> {
    const suggestions = [];
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection not established');
    }
    const existingIndexes = await db.collection(collection).indexes();

    // Analyze query shape
    const fields = this.extractQueryFields(mongoQuery);
    
    // Check for missing indexes on frequently queried fields
    for (const field of fields) {
      if (!this.isFieldIndexed(field, existingIndexes)) {
        suggestions.push({
          fields: [field],
          reason: `Frequently queried field '${field}' is not indexed`
        });
      }
    }

    // Suggest compound indexes for multiple field queries
    if (fields.length > 1) {
      if (!this.isCompoundIndexed(fields, existingIndexes)) {
        suggestions.push({
          fields: fields,
          reason: `Consider a compound index for frequently combined fields: ${fields.join(', ')}`
        });
      }
    }

    return suggestions;
  }

  private extractQueryFields(query: any, prefix = ''): string[] {
    const fields = [];
    
    for (const key in query) {
      if (key.startsWith('$')) continue;
      
      const fullPath = prefix ? `${prefix}.${key}` : key;
      
      if (typeof query[key] === 'object' && !Array.isArray(query[key])) {
        fields.push(...this.extractQueryFields(query[key], fullPath));
      } else {
        fields.push(fullPath);
      }
    }
    
    return fields;
  }

  private isFieldIndexed(field: string, indexes: any[]): boolean {
    return indexes.some(index => 
      index.key[field] !== undefined || 
      index.key[`${field}_1`] !== undefined || 
      index.key[`${field}_-1`] !== undefined
    );
  }

  private isCompoundIndexed(fields: string[], indexes: any[]): boolean {
    return indexes.some(index => {
      const indexFields = Object.keys(index.key);
      return fields.every(field => 
        indexFields.includes(field) || 
        indexFields.includes(`${field}_1`) || 
        indexFields.includes(`${field}_-1`)
      );
    });
  }
}

export default new QueryExplanationService(); 