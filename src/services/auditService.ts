import { AuditLog } from '../models/AuditLog';
import { performance } from 'perf_hooks';

class AuditService {
  private startTime: number;
  private checkpoints: Map<string, number>;

  constructor() {
    this.startTime = 0;
    this.checkpoints = new Map();
  }

  startTracking(): void {
    this.startTime = performance.now();
    this.checkpoints.clear();
  }

  markCheckpoint(name: string): void {
    this.checkpoints.set(name, performance.now());
  }

  private getDuration(start: number, end: number): number {
    return Math.round(end - start);
  }

  async logQuery({
    userId,
    userRole,
    naturalLanguageQuery,
    mongoDbQuery,
    deepSeekResponse,
    collection,
    tokenCount,
    error = null
  }: {
    userId: string;
    userRole: string;
    naturalLanguageQuery: string;
    mongoDbQuery: any;
    deepSeekResponse: any;
    collection: string;
    tokenCount: number;
    error?: any;
  }): Promise<void> {
    const endTime = performance.now();

    const queryGenerationTime = this.checkpoints.get('queryGeneration')
      ? this.getDuration(this.startTime, this.checkpoints.get('queryGeneration')!)
      : 0;

    const queryExecutionTime = this.checkpoints.get('queryExecution')
      ? this.getDuration(this.checkpoints.get('queryGeneration')!, this.checkpoints.get('queryExecution')!)
      : 0;

    const totalDuration = this.getDuration(this.startTime, endTime);

    try {
      await AuditLog.create({
        userId,
        timestamp: new Date(),
        naturalLanguageQuery,
        mongoDbQuery,
        deepSeekResponse,
        performance: {
          totalDuration,
          queryGeneration: queryGenerationTime,
          queryExecution: queryExecutionTime,
          tokenCount
        },
        metadata: {
          userRole,
          collection,
          status: error ? 'error' : 'success',
          error: error ? this.formatError(error) : null
        }
      });
    } catch (err) {
      console.error('Failed to create audit log:', err);
      // Don't throw the error to prevent affecting the main application flow
    }
  }

  private formatError(error: any): object {
    return {
      message: error.message || String(error),
      stack: error.stack,
      code: error.code,
      name: error.name
    };
  }

  async getQueryStats(userId?: string): Promise<any> {
    const match = userId ? { userId } : {};
    
    return AuditLog.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalQueries: { $sum: 1 },
          avgDuration: { $avg: '$performance.totalDuration' },
          avgTokenCount: { $avg: '$performance.tokenCount' },
          successRate: {
            $avg: { $cond: [{ $eq: ['$metadata.status', 'success'] }, 1, 0] }
          }
        }
      },
      {
        $project: {
          _id: 0,
          totalQueries: 1,
          avgDuration: { $round: ['$avgDuration', 2] },
          avgTokenCount: { $round: ['$avgTokenCount', 2] },
          successRate: { $multiply: [{ $round: ['$successRate', 4] }, 100] }
        }
      }
    ]);
  }

  async getRecentQueries(userId?: string, limit = 10): Promise<any[]> {
    const match = userId ? { userId } : {};
    
    return AuditLog.find(match)
      .select('-deepSeekResponse')  // Exclude large fields
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();
  }

  async getPerformanceMetrics(timeRange: { start: Date; end: Date }): Promise<any> {
    return AuditLog.aggregate([
      {
        $match: {
          timestamp: {
            $gte: timeRange.start,
            $lte: timeRange.end
          }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$timestamp'
            }
          },
          avgDuration: { $avg: '$performance.totalDuration' },
          maxDuration: { $max: '$performance.totalDuration' },
          totalQueries: { $sum: 1 },
          errorCount: {
            $sum: { $cond: [{ $eq: ['$metadata.status', 'error'] }, 1, 0] }
          }
        }
      },
      { $sort: { _id: 1 } }
    ]);
  }
}

export default new AuditService(); 