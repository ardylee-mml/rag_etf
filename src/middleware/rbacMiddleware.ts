import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { LRUCache } from 'lru-cache';

export interface UserRole {
  role: 'admin' | 'user' | 'readonly';
  collections: string[];
}

interface DecodedToken {
  userId: string;
  role: string;
}

// Cache for storing user permissions
const permissionsCache = new LRUCache<string, UserRole>({
  max: 500, // Maximum number of items
  ttl: 1000 * 60 * 15, // 15 minutes TTL
});

// Define collection access by role
const rolePermissions: Record<string, string[]> = {
  admin: ['*'], // Admin has access to all collections
  user: ['users', 'conversations', 'queries'], // Regular user has limited access
  readonly: ['queries'] // Read-only user can only query
};

// Dangerous operations that should be restricted
const restrictedOperations = [
  /\bdrop\b/i,
  /\bdelete\b/i,
  /\bremove\b/i,
  /\btruncate\b/i,
  /\bdestroy\b/i
];

export const rbacMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as DecodedToken;
    
    // Check cache first
    let userRole = permissionsCache.get(decoded.userId);
    
    if (!userRole) {
      // If not in cache, get from database and cache it
      userRole = {
        role: decoded.role as UserRole['role'],
        collections: rolePermissions[decoded.role] || []
      };
      permissionsCache.set(decoded.userId, userRole);
    }

    // Check if user has access to the requested collection
    const requestedCollection = req.params.collection || req.body.collection;
    if (requestedCollection && !hasCollectionAccess(userRole, requestedCollection)) {
      return res.status(403).json({ error: 'Access denied to this collection' });
    }

    // Sanitize query if present
    if (req.body.query) {
      if (!isQuerySafe(req.body.query, userRole.role)) {
        return res.status(403).json({ error: 'Query contains restricted operations' });
      }
    }

    // Add role to request for downstream middleware
    req.user = {
      ...decoded,
      permissions: userRole
    };

    // Set query timeout based on role
    req.queryTimeout = getQueryTimeout(userRole.role);

    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

function hasCollectionAccess(userRole: UserRole, collection: string): boolean {
  return userRole.collections.includes('*') || userRole.collections.includes(collection);
}

function isQuerySafe(query: string, role: string): boolean {
  // Admin can execute any query
  if (role === 'admin') return true;

  // Check for restricted operations
  return !restrictedOperations.some(pattern => pattern.test(query));
}

function getQueryTimeout(role: string): number {
  switch (role) {
    case 'admin':
      return 30000; // 30 seconds for admin
    case 'user':
      return 15000; // 15 seconds for regular users
    case 'readonly':
      return 10000; // 10 seconds for readonly users
    default:
      return 5000; // 5 seconds default
  }
} 