import { Request, Response, NextFunction } from 'express';

export const timeoutMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const timeout = req.queryTimeout || 5000; // Default 5 seconds if not set
  
  // Create a timeout promise
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error('Query timeout exceeded'));
    }, timeout);
  });

  // Store the original json method
  const originalJson = res.json;
  let responded = false;

  // Override the json method to race with timeout
  res.json = function(body) {
    if (responded) return res;
    responded = true;
    return originalJson.call(this, body);
  };

  // Race between the next middleware and timeout
  Promise.race([
    new Promise((resolve) => {
      next();
      resolve(null);
    }),
    timeoutPromise
  ]).catch((error) => {
    if (!responded) {
      responded = true;
      res.status(408).json({
        error: 'Request timeout',
        message: error.message
      });
    }
  });
}; 