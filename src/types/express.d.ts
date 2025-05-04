import { UserRole } from '../middleware/rbacMiddleware';

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        username: string;
        role?: string;
        permissions?: UserRole;
      };
      queryTimeout?: number;
    }
  }
} 