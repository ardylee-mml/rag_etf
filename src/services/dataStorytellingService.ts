import { DataStory } from '../models/DataStory';
import mongoose from 'mongoose';
import { jStat } from 'jstat';
import { createReport } from 'docx';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell } from 'docx';
import * as marked from 'marked';
import * as pdf from 'html-pdf';
import CacheService from './cacheService';
import BatchProcessor from './batchProcessor';

class DataStorytellingService {
  private cacheService: CacheService;
  private batchProcessor: BatchProcessor;

  constructor() {
    this.cacheService = CacheService.getInstance();
    this.batchProcessor = BatchProcessor.getInstance();
  }

  async createStory(
    queries: Array<{ queryId: string; result: any; naturalQuery: string }>, 
    metadata: any,
    forceRefresh: boolean = false
  ): Promise<{ story: any; source: 'cache' | 'fresh' }> {
    const cacheKey = this.cacheService.generateKey(queries);

    // Try to get from cache if not forcing refresh
    if (!forceRefresh) {
      const cached = await this.cacheService.get(cacheKey);
      if (cached) {
        return {
          story: cached.data,
          source: cached.source
        };
      }
    }
    
    // Generate new story with parallel processing
    const storyId = new mongoose.Types.ObjectId().toString();
    
    // Submit parallel analysis jobs
    const analysisJobId = await this.batchProcessor.submitAnalysisBatch({
      documents: queries.map(q => q.result).flat(),
      fields: this.extractRelevantFields(queries),
      options: {
        parallel: true,
        batchSize: 1000
      }
    });

    // Wait for analysis to complete
    const analysis = await this.waitForJobCompletion(analysisJobId);
    
    // Generate visualizations in parallel
    const visualizations = await this.generateVisualizationsParallel(queries, analysis);
    
    // Create the story
    const story = await DataStory.create({
      storyId,
      title: this.generateTitle(queries, analysis),
      queries: queries.map(q => ({
        ...q,
        timestamp: new Date()
      })),
      analysis,
      visualizations,
      metadata: {
        ...metadata,
        timeRange: this.extractTimeRange(queries)
      }
    });

    // Cache the new story
    await this.cacheService.set(cacheKey, story);

    return {
      story,
      source: 'fresh'
    };
  }

  private async waitForJobCompletion(jobId: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const checkStatus = () => {
        const job = this.batchProcessor.getJobStatus(jobId);
        if (!job) {
          reject(new Error('Job not found'));
          return;
        }

        switch (job.status) {
          case 'completed':
            resolve(job.result);
            break;
          case 'failed':
            reject(job.error);
            break;
          default:
            setTimeout(checkStatus, 500);
        }
      };

      checkStatus();
    });
  }

  private async generateVisualizationsParallel(queries: any[], analysis: any): Promise<any[]> {
    // Submit parallel jobs for different visualization types
    const jobs = [];

    // Trend visualizations
    if (analysis.trends?.length > 0) {
      const trendJobId = await this.batchProcessor.submitAnalysisBatch({
        documents: analysis.trends,
        fields: ['dataPoints', 'description'],
        options: { parallel: true }
      });
      jobs.push({ type: 'trend', jobId: trendJobId });
    }

    // Correlation visualizations
    if (analysis.correlations?.length > 0) {
      const correlationJobId = await this.batchProcessor.submitComparisonBatch({
        sourceDocuments: queries.map(q => q.result).flat(),
        targetDocuments: queries.map(q => q.result).flat(),
        fields: analysis.correlations.map(c => c.variables).flat(),
        options: { method: 'exact' }
      });
      jobs.push({ type: 'correlation', jobId: correlationJobId });
    }

    // Wait for all visualization jobs to complete
    const results = await Promise.all(
      jobs.map(async job => {
        const result = await this.waitForJobCompletion(job.jobId);
        return { type: job.type, data: result };
      })
    );

    // Transform results into visualizations
    return this.transformToVisualizations(results);
  }

  private transformToVisualizations(results: Array<{ type: string; data: any }>): any[] {
    const visualizations = [];

    results.forEach(result => {
      switch (result.type) {
        case 'trend':
          visualizations.push(...result.data.map(trend => ({
            type: 'line',
            title: `Trend Analysis: ${trend.description}`,
            data: trend.dataPoints,
            config: {
              xAxis: { type: 'category' },
              yAxis: { type: 'value' }
            }
          })));
          break;

        case 'correlation':
          visualizations.push(...result.data.map(correlation => ({
            type: 'scatter',
            title: `Correlation Analysis`,
            data: correlation.matches,
            config: {
              xAxis: { name: correlation.variables[0] },
              yAxis: { name: correlation.variables[1] }
            }
          })));
          break;
      }
    });

    return visualizations;
  }

  private extractRelevantFields(queries: any[]): string[] {
    const fields = new Set<string>();
    queries.forEach(query => {
      if (Array.isArray(query.result)) {
        query.result.forEach(doc => {
          Object.keys(doc).forEach(key => fields.add(key));
        });
      }
    });
    return Array.from(fields);
  }

  private async analyzeResults(queries: any[]): Promise<any> {
    const summary = this.generateSummary(queries);
    const keyFindings = this.extractKeyFindings(queries);
    const trends = await this.identifyTrends(queries);
    const anomalies = this.detectAnomalies(queries);
    const correlations = this.findCorrelations(queries);

    return {
      summary,
      keyFindings,
      trends,
      anomalies,
      correlations
    };
  }

  private generateSummary(queries: any[]): string {
    let summary = 'Analysis based on ' + queries.length + ' queries. ';
    
    // Add high-level overview
    const totalRecords = queries.reduce((sum, q) => 
      sum + (Array.isArray(q.result) ? q.result.length : 1), 0);
    summary += `Analyzed ${totalRecords} records in total. `;

    // Add time range if available
    const timeRange = this.extractTimeRange(queries);
    if (timeRange.start && timeRange.end) {
      summary += `Data spans from ${timeRange.start.toLocaleDateString()} to ${timeRange.end.toLocaleDateString()}. `;
    }

    return summary;
  }

  private extractKeyFindings(queries: any[]): string[] {
    const findings = [];

    // Analyze each query result
    queries.forEach(query => {
      const result = query.result;
      
      // Check for empty results
      if (!result || (Array.isArray(result) && result.length === 0)) {
        findings.push(`Query "${query.naturalQuery}" returned no results`);
        return;
      }

      // Analyze numerical fields
      if (Array.isArray(result)) {
        Object.keys(result[0]).forEach(field => {
          if (typeof result[0][field] === 'number') {
            const values = result.map(r => r[field]);
            const stats = this.calculateStats(values);
            
            if (stats.outliers.length > 0) {
              findings.push(`Found ${stats.outliers.length} outliers in ${field}`);
            }
            
            if (stats.trend !== 'stable') {
              findings.push(`${field} shows a ${stats.trend} trend`);
            }
          }
        });
      }
    });

    return findings;
  }

  private async identifyTrends(queries: any[]): Promise<any[]> {
    const trends = [];

    for (const query of queries) {
      if (!Array.isArray(query.result)) continue;

      const result = query.result;
      const numericalFields = Object.keys(result[0]).filter(
        key => typeof result[0][key] === 'number'
      );

      for (const field of numericalFields) {
        const values = result.map(r => r[field]);
        const trend = this.analyzeTrend(values);
        
        if (trend.significance > 0.5) {
          trends.push({
            description: `${field} shows a ${trend.direction} pattern`,
            significance: trend.significance,
            direction: trend.direction,
            dataPoints: trend.dataPoints
          });
        }
      }
    }

    return trends;
  }

  private detectAnomalies(queries: any[]): any[] {
    const anomalies = [];

    queries.forEach(query => {
      if (!Array.isArray(query.result)) return;

      const result = query.result;
      Object.keys(result[0]).forEach(field => {
        if (typeof result[0][field] === 'number') {
          const values = result.map(r => r[field]);
          const stats = this.calculateStats(values);
          
          stats.outliers.forEach(outlier => {
            anomalies.push({
              description: `Unusual ${field} value detected`,
              severity: this.calculateOutlierSeverity(outlier, stats),
              location: field,
              value: outlier
            });
          });
        }
      });
    });

    return anomalies;
  }

  private findCorrelations(queries: any[]): any[] {
    const correlations = [];

    queries.forEach(query => {
      if (!Array.isArray(query.result)) return;

      const result = query.result;
      const numericalFields = Object.keys(result[0]).filter(
        key => typeof result[0][key] === 'number'
      );

      // Check correlations between numerical fields
      for (let i = 0; i < numericalFields.length; i++) {
        for (let j = i + 1; j < numericalFields.length; j++) {
          const field1 = numericalFields[i];
          const field2 = numericalFields[j];
          
          const values1 = result.map(r => r[field1]);
          const values2 = result.map(r => r[field2]);
          
          const correlation = this.calculateCorrelation(values1, values2);
          
          if (Math.abs(correlation) > 0.5) {
            correlations.push({
              variables: [field1, field2],
              strength: correlation,
              description: this.describeCorrelation(field1, field2, correlation)
            });
          }
        }
      }
    });

    return correlations;
  }

  private calculateStats(values: number[]): any {
    const mean = jStat.mean(values);
    const std = jStat.stdev(values);
    const outliers = values.filter(v => Math.abs(v - mean) > 2 * std);
    
    return {
      mean,
      std,
      outliers,
      trend: this.determineTrend(values)
    };
  }

  private analyzeTrend(values: number[]): any {
    const n = values.length;
    if (n < 2) return { direction: 'stable', significance: 0, dataPoints: [] };

    // Calculate linear regression
    const xValues = Array.from({ length: n }, (_, i) => i);
    const slope = this.calculateSlope(xValues, values);
    
    // Calculate R-squared
    const correlation = this.calculateCorrelation(xValues, values);
    const rSquared = correlation * correlation;

    return {
      direction: slope > 0 ? 'increasing' : slope < 0 ? 'decreasing' : 'stable',
      significance: rSquared,
      dataPoints: values
    };
  }

  private calculateSlope(x: number[], y: number[]): number {
    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
    
    return (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  }

  private calculateCorrelation(x: number[], y: number[]): number {
    return jStat.correlation(x, y);
  }

  private calculateOutlierSeverity(outlier: number, stats: any): number {
    return Math.min(Math.abs(outlier - stats.mean) / (3 * stats.std), 1);
  }

  private determineTrend(values: number[]): string {
    const slope = this.calculateSlope(
      Array.from({ length: values.length }, (_, i) => i),
      values
    );
    
    if (Math.abs(slope) < 0.1) return 'stable';
    return slope > 0 ? 'increasing' : 'decreasing';
  }

  private describeCorrelation(field1: string, field2: string, correlation: number): string {
    const strength = Math.abs(correlation) > 0.8 ? 'strong' : 'moderate';
    const direction = correlation > 0 ? 'positive' : 'negative';
    return `${strength} ${direction} correlation between ${field1} and ${field2}`;
  }

  private generateTitle(queries: any[], analysis: any): string {
    const collections = [...new Set(queries.map(q => q.collection))];
    const timeRange = this.extractTimeRange(queries);
    
    let title = 'Data Analysis';
    if (collections.length === 1) {
      title += ` for ${collections[0]}`;
    }
    if (timeRange.start && timeRange.end) {
      title += ` (${timeRange.start.toLocaleDateString()} - ${timeRange.end.toLocaleDateString()})`;
    }
    
    return title;
  }

  private extractTimeRange(queries: any[]): { start: Date; end: Date } {
    const timestamps = queries.flatMap(q => 
      Array.isArray(q.result) 
        ? q.result.map(r => r.timestamp || r.date || r.createdAt).filter(Boolean)
        : []
    );

    if (timestamps.length === 0) {
      return { start: null, end: null };
    }

    return {
      start: new Date(Math.min(...timestamps)),
      end: new Date(Math.max(...timestamps))
    };
  }

  async exportToPDF(storyId: string): Promise<Buffer> {
    const story = await DataStory.findOne({ storyId });
    if (!story) throw new Error('Story not found');

    const html = this.generateHTML(story);
    
    return new Promise((resolve, reject) => {
      pdf.create(html, {
        format: 'A4',
        border: '1cm'
      }).toBuffer((err, buffer) => {
        if (err) reject(err);
        else resolve(buffer);
      });
    });
  }

  async exportToMarkdown(storyId: string): Promise<string> {
    const story = await DataStory.findOne({ storyId });
    if (!story) throw new Error('Story not found');

    let markdown = `# ${story.title}\n\n`;
    
    // Add summary
    markdown += `## Summary\n${story.analysis.summary}\n\n`;
    
    // Add key findings
    markdown += '## Key Findings\n';
    story.analysis.keyFindings.forEach(finding => {
      markdown += `- ${finding}\n`;
    });
    markdown += '\n';
    
    // Add trends
    if (story.analysis.trends.length > 0) {
      markdown += '## Identified Trends\n';
      story.analysis.trends.forEach(trend => {
        markdown += `### ${trend.description}\n`;
        markdown += `- Significance: ${(trend.significance * 100).toFixed(1)}%\n`;
        markdown += `- Direction: ${trend.direction}\n\n`;
      });
    }
    
    // Add anomalies
    if (story.analysis.anomalies.length > 0) {
      markdown += '## Detected Anomalies\n';
      story.analysis.anomalies.forEach(anomaly => {
        markdown += `- ${anomaly.description} (Severity: ${(anomaly.severity * 100).toFixed(1)}%)\n`;
      });
      markdown += '\n';
    }
    
    // Add correlations
    if (story.analysis.correlations.length > 0) {
      markdown += '## Correlations\n';
      story.analysis.correlations.forEach(correlation => {
        markdown += `- ${correlation.description}\n`;
      });
    }
    
    // Add metadata
    markdown += '\n## Metadata\n';
    markdown += `- Author: ${story.metadata.author}\n`;
    markdown += `- Created: ${story.createdAt.toLocaleDateString()}\n`;
    markdown += `- Tags: ${story.metadata.tags.join(', ')}\n`;
    
    return markdown;
  }

  private generateHTML(story: any): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; }
            .container { max-width: 800px; margin: 0 auto; padding: 20px; }
            .section { margin-bottom: 30px; }
            .chart { width: 100%; height: 300px; margin: 20px 0; }
            .trend { padding: 10px; background: #f5f5f5; margin: 10px 0; }
            .anomaly { color: #d32f2f; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>${story.title}</h1>
            
            <div class="section">
              <h2>Summary</h2>
              <p>${story.analysis.summary}</p>
            </div>

            <div class="section">
              <h2>Key Findings</h2>
              <ul>
                ${story.analysis.keyFindings.map(finding => `<li>${finding}</li>`).join('')}
              </ul>
            </div>

            ${this.generateVisualizationsHTML(story.visualizations)}

            <div class="section">
              <h2>Trends</h2>
              ${story.analysis.trends.map(trend => `
                <div class="trend">
                  <h3>${trend.description}</h3>
                  <p>Significance: ${(trend.significance * 100).toFixed(1)}%</p>
                  <p>Direction: ${trend.direction}</p>
                </div>
              `).join('')}
            </div>

            <div class="section">
              <h2>Anomalies</h2>
              <ul>
                ${story.analysis.anomalies.map(anomaly => `
                  <li class="anomaly">
                    ${anomaly.description} (Severity: ${(anomaly.severity * 100).toFixed(1)}%)
                  </li>
                `).join('')}
              </ul>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  private generateVisualizationsHTML(visualizations: any[]): string {
    return visualizations.map(viz => `
      <div class="section">
        <h2>${viz.title}</h2>
        <p>${viz.description}</p>
        <div class="chart" id="${viz.title.replace(/\s+/g, '-')}">
          <!-- Visualization placeholder -->
        </div>
      </div>
    `).join('');
  }

  // Add method to invalidate cache
  async invalidateCache(queryIds: string[]): Promise<void> {
    await this.cacheService.invalidateAll();
  }
}

export default new DataStorytellingService(); 