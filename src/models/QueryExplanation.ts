import mongoose from 'mongoose';

const queryExplanationSchema = new mongoose.Schema({
  queryId: {
    type: String,
    required: true,
    index: true
  },
  originalQuery: {
    text: String,
    timestamp: {
      type: Date,
      default: Date.now
    }
  },
  interpretation: {
    intent: String,
    entities: [{
      name: String,
      value: String,
      type: String
    }],
    conditions: [String],
    confidence: Number
  },
  execution: {
    usedIndexes: [{
      name: String,
      field: String,
      type: String,
      efficiency: Number
    }],
    estimatedComplexity: {
      timeComplexity: String,
      documentsExamined: Number,
      indexesUsed: Number
    },
    executionStats: mongoose.Schema.Types.Mixed
  },
  suggestions: {
    alternativePhrasing: [String],
    optimizationTips: [String],
    recommendedIndexes: [{
      fields: [String],
      reason: String
    }]
  },
  metadata: {
    collection: String,
    duration: Number,
    status: String
  }
});

// Create indexes for common queries
queryExplanationSchema.index({ 'originalQuery.timestamp': -1 });
queryExplanationSchema.index({ 'metadata.collection': 1 });
queryExplanationSchema.index({ 'interpretation.confidence': 1 });

export const QueryExplanation = mongoose.model('QueryExplanation', queryExplanationSchema); 