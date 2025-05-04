require('dotenv').config();
const axios = require('axios');
const jwt = require('jsonwebtoken');

// Generate a JWT token for testing
const generateToken = () => {
  const payload = {
    userId: 'test-user-id',
    username: 'test'
  };

  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '24h'
  });
};

// Test the login endpoint
const testLogin = async () => {
  try {
    console.log('Testing login endpoint...');
    const response = await axios.post('http://localhost:3001/api/auth/login', {
      username: 'test',
      password: 'test'
    });
    console.log('Login response:', response.data);
    return response.data.token;
  } catch (error) {
    console.error('Login error:', error.message);
    return generateToken(); // Fallback to generating a token
  }
};

// Test the query endpoint
const testQuery = async (token) => {
  try {
    console.log('\nTesting query endpoint...');
    const response = await axios.post(
      'http://localhost:3001/api/query',
      {
        query: 'Find events where type is zone and context.zoneId contains S1-R1-LivRm',
        collection: 'events',
        schemaInfo: {
          players: { idField: 'playerId' },
          events: {
            playerIdField: 'playerId',
            itemIdField: 'context.itemId',
            zoneIdField: 'context.zoneId',
            questionIdField: 'context.questionId'
          },
          items: { idField: '_id' },
          zones: { idField: '_id' },
          questions: { idField: '_id' },
          leaderboards: { playerIdField: 'playerId' }
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log('Query response status:', response.status);
    console.log('Query results count:', response.data.results.length);
    console.log('First result:', JSON.stringify(response.data.results[0], null, 2));
  } catch (error) {
    console.error('Query error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
};

// Test the relationship query endpoint
const testRelationshipQuery = async (token) => {
  try {
    console.log('\nTesting relationship query endpoint...');
    const response = await axios.post(
      'http://localhost:3001/api/query/relationship',
      {
        query: 'Find relationship between players and events',
        primaryCollection: 'players',
        relatedCollection: 'events',
        schemaInfo: {
          players: { idField: 'playerId' },
          events: {
            playerIdField: 'playerId',
            itemIdField: 'context.itemId',
            zoneIdField: 'context.zoneId',
            questionIdField: 'context.questionId'
          },
          items: { idField: '_id' },
          zones: { idField: '_id' },
          questions: { idField: '_id' },
          leaderboards: { playerIdField: 'playerId' }
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log('Relationship query response status:', response.status);
    console.log('Relationship query results count:', response.data.results.length);
    console.log('First result:', JSON.stringify(response.data.results[0], null, 2));
  } catch (error) {
    console.error('Relationship query error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
};

// Run the tests
const runTests = async () => {
  try {
    const token = await testLogin();
    if (token) {
      await testQuery(token);
      await testRelationshipQuery(token);
    }
  } catch (error) {
    console.error('Test error:', error);
  }
};

runTests();
