import { Request, Response, NextFunction } from 'express';
import auditService from '../services/auditService';

export interface AuditRequest extends Request {
  user?: {
    userId: string;
    role: string;
    permissions: any;
  };
  auditData?: {
    naturalLanguageQuery: string;
    mongoDbQuery: any;
    deepSeekResponse: any;
    tokenCount: number;
  };
  params: {
    collection?: string;
  };
  body: {
    collection?: string;
    query?: string;
  };
}

export const auditMiddleware = (req: AuditRequest, res: Response, next: NextFunction) => {
  // Start performance tracking
  auditService.startTracking();

  // Store the original end function
  const originalEnd = res.end;
  const originalJson = res.json;

  // Override json method to capture response
  res.json = function (body: any) {
    if (req.user) {
      const auditData = req.auditData || {};
      
      auditService.logQuery({
        userId: req.user.userId,
        userRole: req.user.role,
        naturalLanguageQuery: auditData.naturalLanguageQuery || '',
        mongoDbQuery: auditData.mongoDbQuery || {},
        deepSeekResponse: auditData.deepSeekResponse || {},
        collection: req.params.collection || req.body.collection || 'unknown',
        tokenCount: auditData.tokenCount || 0,
        error: res.statusCode >= 400 ? body : null
      }).catch(err => console.error('Audit logging failed:', err));
    }

    return originalJson.call(this, body);
  };

  // Override end function to ensure we catch all responses
  res.end = function (chunk: any, encoding: BufferEncoding, cb?: () => void) {
    if (req.user && !res.headersSent) {
      const auditData = req.auditData || {};
      
      auditService.logQuery({
        userId: req.user.userId,
        userRole: req.user.role,
        naturalLanguageQuery: auditData.naturalLanguageQuery || '',
        mongoDbQuery: auditData.mongoDbQuery || {},
        deepSeekResponse: auditData.deepSeekResponse || {},
        collection: req.params.collection || req.body.collection || 'unknown',
        tokenCount: auditData.tokenCount || 0,
        error: res.statusCode >= 400 ? chunk?.toString() : null
      }).catch(err => console.error('Audit logging failed:', err));
    }

    return originalEnd.call(this, chunk, encoding, cb);
  };

  next();
}; 