require('dotenv').config();
const axios = require('axios');
const jwt = require('jsonwebtoken');

// Configuration
const SERVER_URL = 'http://localhost:3000';
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Generate a JWT token for testing
const generateToken = () => {
  const payload = {
    userId: 'test-user-id',
    username: 'test'
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: '24h'
  });
};

// Test the relationship query endpoint
const testRelationshipQuery = async () => {
  try {
    console.log('Testing relationship query endpoint...');
    console.log(`Server URL: ${SERVER_URL}`);

    // Generate a token
    const token = generateToken();
    console.log('Generated token:', token);

    // Define the relationship query
    const queryData = {
      query: 'Average how many times players need to answer a question correctly?',
      primaryCollection: 'events',
      relatedCollection: 'questions',
      // Force the use of our improved pipeline with case-insensitive matching
      forcePipeline: [
        { $match: { type: 'question' } },
        { $group: {
            _id: {
                playerId: '$playerId',
                questionId: '$context.questionId'
            },
            count: { $sum: 1 }
          }
        },
        { $group: {
            _id: '$_id.questionId',
            avgAttempts: { $avg: '$count' }
          }
        },
        { $project: {
            questionId: '$_id',
            avgAttempts: 1,
            // Convert questionId to lowercase for case-insensitive matching
            questionIdLower: { $toLower: '$_id' },
            _id: 0
          }
        },
        // Use $lookup with $expr to do case-insensitive matching
        { $lookup: {
            from: 'questions',
            let: { qid: '$questionIdLower' },
            pipeline: [
              { $addFields: { idLower: { $toLower: { $toString: '$_id' } } } },
              { $match: { $expr: { $eq: ['$idLower', '$$qid'] } } }
            ],
            as: 'questionDetails'
          }
        },
        // Add question text and additional information to the output
        { $project: {
            questionId: 1,
            avgAttempts: 1,
            // Use $ifNull to handle cases where question details might not be found
            questionText: {
              $ifNull: [
                { $arrayElemAt: ['$questionDetails.text', 0] },
                'Question text not available'
              ]
            },
            // Add a message explaining the situation
            message: {
              $cond: {
                if: { $eq: [{ $size: '$questionDetails' }, 0] },
                then: 'No matching question found. This may be due to the ID format difference.',
                else: ''
              }
            },
            // Include the number of attempts for this question
            totalAttempts: { $round: ['$avgAttempts', 0] }
          }
        },
        { $sort: { avgAttempts: -1 } }
      ],
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

    // Make the API request
    console.log('Sending request to:', `${SERVER_URL}/api/query/relationship`);
    const response = await axios.post(
      `${SERVER_URL}/api/query/relationship`,
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
        console.log(`Result ${index + 1}:`);
        console.log(`  Question ID: ${result.questionId}`);
        console.log(`  Question Text: ${result.questionText || 'Not available'}`);
        console.log(`  Average Attempts: ${result.avgAttempts.toFixed(2)} (${result.totalAttempts} attempts on average)`);
        if (result.message) {
          console.log(`  Note: ${result.message}`);
        }
        console.log('---');
      });

      // Calculate overall average if the results contain avgAttempts
      if (response.data.results[0].avgAttempts) {
        const overallAvg = response.data.results.reduce((sum, result) => sum + result.avgAttempts, 0) / response.data.results.length;
        console.log(`Overall average attempts per question: ${overallAvg.toFixed(2)}`);
      }

      // Print total number of questions analyzed
      console.log(`Total questions analyzed: ${response.data.results.length}`);

      // Count questions with available text
      const questionsWithText = response.data.results.filter(r => r.questionText && r.questionText !== 'Question text not available').length;
      console.log(`Questions with text available: ${questionsWithText} (${((questionsWithText / response.data.results.length) * 100).toFixed(2)}%)`);
    } else {
      console.log('No results returned');
    }

    console.log('Pipeline used:', JSON.stringify(response.data.pipeline, null, 2));
    console.log('Explanation:', response.data.explanation);

    return true;
  } catch (error) {
    console.error('Error testing relationship query endpoint:');
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    } else {
      console.error(error.message);
    }
    return false;
  }
};

// Main function
const main = async () => {
  console.log('Starting test...');

  // Test the relationship query
  const success = await testRelationshipQuery();

  if (success) {
    console.log('Test completed successfully!');
  } else {
    console.log('Test failed!');
    process.exit(1);
  }
};

// Run the main function
main();
