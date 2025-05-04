const deepseekService = require('./src/services/deepseekService');

// Test the Deepseek service with a sample query
async function testDeepseekService() {
  try {
    console.log('Testing Deepseek service...');

    const query = 'Count how many times each of the questions had been answered.';
    const collectionName = 'events';

    // Define schema info
    const schemaInfo = {
      events: {
        playerIdField: 'playerId',
        itemIdField: 'context.itemId',
        zoneIdField: 'context.zoneId',
        questionIdField: 'context.questionId'
      },
      players: {
        idField: 'playerId'
      }
    };

    console.log('Query:', query);
    console.log('Collection:', collectionName);

    // Test the generateFallbackPipeline method
    console.log('\nTesting generateFallbackPipeline method...');
    const fallbackPipeline = deepseekService.generateFallbackPipeline(query, collectionName);
    console.log('Fallback Pipeline:');
    console.log(JSON.stringify(fallbackPipeline, null, 2));

    // Test the extractMongoDBPipeline method with a sample response
    console.log('\nTesting extractMongoDBPipeline method...');

    // Sample LLM response with a valid pipeline
    const sampleResponse = `
Here's a MongoDB aggregation pipeline to count how many times each question has been answered:

[
  {
    "$match": {
      "type": "question"
    }
  },
  {
    "$group": {
      "_id": "$context.questionId",
      "count": {
        "$sum": 1
      }
    }
  },
  {
    "$lookup": {
      "from": "questions",
      "localField": "_id",
      "foreignField": "_id",
      "as": "questionDetails"
    }
  },
  {
    "$unwind": {
      "path": "$questionDetails",
      "preserveNullAndEmptyArrays": true
    }
  },
  {
    "$project": {
      "_id": 0,
      "questionId": "$_id",
      "questionText": "$questionDetails.text",
      "count": 1
    }
  },
  {
    "$sort": {
      "count": -1
    }
  }
]
`;

    const extractedPipeline = deepseekService.extractMongoDBPipeline(sampleResponse, query, collectionName);
    console.log('Extracted Pipeline:');
    console.log(JSON.stringify(extractedPipeline, null, 2));

    // Test with an invalid response
    console.log('\nTesting extractMongoDBPipeline with invalid response...');
    const invalidResponse = "I'm having trouble processing your request. Please try again or rephrase your query.";
    const extractedFromInvalid = deepseekService.extractMongoDBPipeline(invalidResponse, query, collectionName);
    console.log('Extracted Pipeline from Invalid Response:');
    console.log(JSON.stringify(extractedFromInvalid, null, 2));

  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run the test
testDeepseekService();
