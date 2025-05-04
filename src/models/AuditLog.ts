import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  naturalLanguageQuery: {
    type: String,
    required: true
  },
  mongoDbQuery: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  deepSeekResponse: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  performance: {
    totalDuration: Number,  // Total request duration in ms
    queryGeneration: Number, // Time taken to generate MongoDB query
    queryExecution: Number, // Time taken to execute MongoDB query
    tokenCount: Number,     // Number of tokens used
  },
  metadata: {
    userRole: String,
    collection: String,
    status: String,
    error: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true // Adds createdAt and updatedAt
});

// Create indexes for common queries
auditLogSchema.index({ 'performance.totalDuration': 1 });
auditLogSchema.index({ 'metadata.status': 1 });
auditLogSchema.index({ 'metadata.collection': 1 });

export const AuditLog = mongoose.model('AuditLog', auditLogSchema); 