# MongoDB RAG System

This repository contains a MongoDB RAG (Retrieval-Augmented Generation) system that uses natural language queries to generate MongoDB aggregation pipelines.

## Important Security Note

This repository contains several server files with hardcoded MongoDB connection strings. These files are for demonstration purposes only and should not be used in production.

Before using this code in production:

1. Remove all hardcoded MongoDB connection strings from the code
2. Use environment variables for all sensitive information
3. Create a proper .env file with your own MongoDB connection string
4. Make sure the .env file is in .gitignore

## Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Create a .env file with the following variables:
   ```
   MONGODB_URI=your_mongodb_connection_string
   DEEPSEEK_API_KEY=your_deepseek_api_key
   JWT_SECRET=your_jwt_secret
   ```
4. Start the server: `node server.js`
5. Start the frontend: `npm run dev`

## Features

- Natural language query to MongoDB aggregation pipeline conversion
- Specialized handlers for common query patterns
- Interactive query interface
- Relationship mapping between collections
- Self-learning system for query pattern generation

## Demo Queries

Here are some example queries you can try:

1. Item Interaction Query:
   ```
   List the top 5 items where type = "item" and context.action = "pickup"
   ```

2. Player Activity Query:
   ```
   How many players played more than 3 times in total?
   ```

3. Zone Engagement Query:
   ```
   Which zones have the highest player engagement and what items were picked up in those zones?
   ```

## License

MIT
