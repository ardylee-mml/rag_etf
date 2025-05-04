# MongoDB RAG API

A Node.js API that connects to MongoDB and accepts natural language queries, featuring JWT authentication and rate limiting.

## Features

- Express.js REST API
- MongoDB integration
- JWT authentication
- Rate limiting (5 requests per minute)
- Error handling for database connection failures
- CORS enabled

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file:
```bash
cp .env.example .env
```

3. Configure your environment variables in `.env`:
- `PORT`: API server port
- `MONGODB_URI`: MongoDB connection string
- `JWT_SECRET`: Secret key for JWT token generation
- `JWT_EXPIRES_IN`: JWT token expiration time

4. Start the server:
```bash
# Development mode
npm run dev

# Production mode
npm start
```

## API Endpoints

### POST /api/query
Process a natural language query.

**Headers:**
- `Authorization: Bearer <your_jwt_token>`
- `Content-Type: application/json`

**Request Body:**
```json
{
    "query": "Your natural language query here"
}
```

**Response:**
```json
{
    "query": "Your query",
    "timestamp": "2024-01-01T00:00:00.000Z",
    "status": "processed"
}
```

## Rate Limiting

The API is limited to 5 requests per minute per IP address.

## Error Handling

The API includes comprehensive error handling for:
- Database connection failures
- Authentication errors
- Rate limiting
- Invalid requests

## Security

- JWT authentication required for all query endpoints
- Rate limiting to prevent abuse
- CORS enabled for secure cross-origin requests 