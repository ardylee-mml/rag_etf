import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

interface Config {
  jwt: {
    secret: string;
    expiresIn: string;
  };
  server: {
    port: number;
    nodeEnv: string;
  };
  mongodb: {
    uri: string;
  };
  rateLimit: {
    windowMs: number;
    maxRequests: number;
  };
  api: {
    deepseekApiKey: string;
    dailyTokenLimit: number;
  };
}

// Validate and export configuration
const config: Config = {
  jwt: {
    secret: requireEnvVar('JWT_SECRET'),
    expiresIn: requireEnvVar('JWT_EXPIRES_IN'),
  },
  server: {
    port: parseInt(requireEnvVar('PORT'), 10),
    nodeEnv: requireEnvVar('NODE_ENV'),
  },
  mongodb: {
    uri: requireEnvVar('MONGODB_URI'),
  },
  rateLimit: {
    windowMs: parseInt(requireEnvVar('RATE_LIMIT_WINDOW_MS'), 10),
    maxRequests: parseInt(requireEnvVar('RATE_LIMIT_MAX_REQUESTS'), 10),
  },
  api: {
    deepseekApiKey: requireEnvVar('DEEPSEEK_API_KEY'),
    dailyTokenLimit: parseInt(requireEnvVar('DAILY_TOKEN_LIMIT'), 10),
  },
};

function requireEnvVar(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export default config; 