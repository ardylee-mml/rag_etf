import { Request, Response, NextFunction, RequestHandler } from 'express';
import jwt, { Secret, JwtPayload, VerifyOptions } from 'jsonwebtoken';
import config from '../config/index';

const JWT_SECRET: Secret = config.jwt.secret;

// Extend Express Request interface
declare module 'express' {
  interface Request {
    user?: {
      userId: string;
      username: string;
    };
  }
}

interface UserPayload extends JwtPayload {
  userId: string;
  username: string;
}

export const authMiddleware: RequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    try {
      const verifyOptions: VerifyOptions = {
        algorithms: ['HS256']
      };
      const decoded = jwt.verify(token, JWT_SECRET, verifyOptions) as UserPayload;
      req.user = {
        userId: decoded.userId,
        username: decoded.username
      };
      next();
    } catch (jwtError) {
      return res.status(401).json({ message: 'Invalid token' });
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const generateToken = (userId: string): string => {
  return jwt.sign({ userId, username: 'test' }, JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: config.jwt.expiresIn
  });
};