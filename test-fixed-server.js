require('dotenv').config();
const axios = require('axios');
const jwt = require('jsonwebtoken');

// Generate a JWT token for testing
const generateToken = () => {
  const payload = {
    userId: 'test-user-id',
    username: 'test'
  };

  return jwt.sign(payload, process.env.JWT_SECRET || 'your-secret-key', {
    expiresIn: '24h'
  });
};

// Test the relationship query endpoint with the fixed server
const testRelationshipQuery = async () => {
  try {
    console.log('Testing relationship query endpoint with fixed server...');

    const token = generateToken();
    const apiUrl = 'http://localhost:3002/api/query/relationship';

    // Define the relationship query
    const queryData = {
      query: 'Average how many times players need to answer a question correctly?',
      primaryCollection: 'events',
      relatedCollection: 'questions',
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
    };

    console.log('Query:', queryData.query);
    console.log('Primary Collection:', queryData.primaryCollection);
    console.log('Related Collection:', queryData.relatedCollection);

    const response = await axios.post(
      apiUrl,
      queryData,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('Response status:', response.status);
    console.log('Results count:', response.data.results.length);

    if (response.data.results.length > 0) {
      console.log('First 5 results:');
      response.data.results.slice(0, 5).forEach((result, index) => {
        console.log(`Result ${index + 1}:`, JSON.stringify(result, null, 2));
      });

      // Calculate overall average if the results contain avgAttempts
      if (response.data.results[0].avgAttempts) {
        const overallAvg = response.data.results.reduce((sum, result) => sum + result.avgAttempts, 0) / response.data.results.length;
        console.log(`Overall average attempts per question: ${overallAvg.toFixed(2)}`);
      }
    } else {
      console.log('No results returned');
    }

    console.log('Pipeline used:', JSON.stringify(response.data.pipeline, null, 2));
    console.log('Explanation:', response.data.explanation);
  } catch (error) {
    console.error('Error testing relationship query endpoint:');
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    } else {
      console.error(error.message);
    }
  }
};

// Run the test
testRelationshipQuery();
