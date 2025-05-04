import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// Process natural language query
router.post('/', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { query, collection = 'events', schemaInfo } = req.body;

    if (!query) {
      return res.status(400).json({
        message: 'Query is required'
      });
    }

    console.log('Processing query:', query);
    console.log('Collection:', collection);
    console.log('Schema Info:', schemaInfo);

    // Get the specified collection
    const db = mongoose.connection.db;
    const mongoCollection = db.collection(collection);

    // For now, just return a simple query result
    // In a real implementation, this would use the Deepseek LLM to process the query
    const results = await mongoCollection.find().limit(10).toArray();

    res.json({
      query,
      timestamp: new Date(),
      results,
      processedQuery: `db.${collection}.find().limit(10)`,
      pipeline: [{ $limit: 10 }]
    });
  } catch (error) {
    console.error('Query execution error:', error);
    next(error);
  }
});

// Process relationship query
router.post('/relationship', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { query, primaryCollection, relatedCollection, schemaInfo } = req.body;

    if (!query || !primaryCollection || !relatedCollection) {
      return res.status(400).json({
        message: 'Query, primaryCollection, and relatedCollection are required'
      });
    }

    console.log('Processing relationship query:', query);
    console.log('Primary Collection:', primaryCollection);
    console.log('Related Collection:', relatedCollection);
    console.log('Schema Info:', schemaInfo);

    // Get the specified collection
    const db = mongoose.connection.db;
    const primaryMongoCollection = db.collection(primaryCollection);

    // For now, just return a simple query result
    // In a real implementation, this would use the Deepseek LLM to process the query
    const results = await primaryMongoCollection.find().limit(10).toArray();

    res.json({
      query,
      timestamp: new Date(),
      results,
      processedQuery: `db.${primaryCollection}.find().limit(10)`,
      pipeline: [{ $limit: 10 }]
    });
  } catch (error) {
    console.error('Relationship query execution error:', error);
    next(error);
  }
});

export default router;
