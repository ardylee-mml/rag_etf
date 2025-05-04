require('dotenv').config();
const mongoose = require('mongoose');

async function simpleFix() {
  try {
    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Get the database
    const db = mongoose.connection.db;
    
    // Create a JSON file with the solution
    console.log('Creating solution JSON file...');
    
    const solution = {
      issue: "The relationship query between events and questions is failing because the $unwind stage fails when there are no matching questions",
      explanation: "The events collection has documents with type 'question', but the questionId in these events doesn't match any _id in the questions collection",
      solution: "Remove the $unwind stage and use conditional projection instead",
      fixedPipeline: [
        {
          $match: {
            type: 'question'
          }
        },
        {
          $lookup: {
            from: 'questions',
            localField: 'context.questionId',
            foreignField: '_id',
            as: 'related'
          }
        },
        {
          $project: {
            event_id: '$_id',
            player_id: '$playerId',
            question_id: '$context.questionId',
            correct: '$correct',
            timeTaken: '$timeTaken',
            type: '$type',
            question_text: { $cond: { if: { $gt: [{ $size: '$related' }, 0] }, then: { $arrayElemAt: ['$related.text', 0] }, else: null } }
          }
        }
      ],
      averageAttemptsPipeline: [
        {
          $match: {
            type: 'question'
          }
        },
        {
          $group: {
            _id: {
              playerId: '$playerId',
              questionId: '$context.questionId'
            },
            count: { $sum: 1 }
          }
        },
        {
          $group: {
            _id: '$_id.questionId',
            avgAttempts: { $avg: '$count' }
          }
        },
        {
          $project: {
            questionId: '$_id',
            avgAttempts: 1,
            _id: 0
          }
        },
        {
          $sort: { avgAttempts: -1 }
        }
      ],
      implementation: "To fix this issue, modify the server code that handles relationship queries to use the fixed pipeline when dealing with events-questions relationships. Skip the $unwind stage and use conditional projection instead."
    };
    
    // Print the solution
    console.log('Solution:');
    console.log(JSON.stringify(solution, null, 2));
    
    // Close the connection
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
  } catch (error) {
    console.error('Error:', error);
  }
}

simpleFix();
