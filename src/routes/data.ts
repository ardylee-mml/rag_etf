import { Router } from 'express';
import type { Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// Protected route example
router.get('/protected', authMiddleware, (req: Request, res: Response) => {
  res.json({
    message: 'This is a protected route',
    userId: req.user?.userId,
    username: req.user?.username,
    timestamp: new Date()
  });
});

// Get data route
router.get('/', authMiddleware, (req: Request, res: Response) => {
  try {
    // TODO: Implement data retrieval logic
    res.json({
      data: [
        { id: 1, name: 'Sample 1' },
        { id: 2, name: 'Sample 2' }
      ]
    });
  } catch (error) {
    console.error('Data retrieval error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;