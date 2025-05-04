require('dotenv').config();
const mongoose = require('mongoose');

async function updateRelationshipQuery() {
  try {
    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Get the database
    const db = mongoose.connection.db;
    
    console.log('Analyzing questions and events...');
    
    // Get all questions
    const questions = await db.collection('questions').find().toArray();
    console.log(`Found ${questions.length} questions`);
    
    // Create a map of question IDs to question text for faster lookups
    const questionMap = new Map();
    for (const question of questions) {
      questionMap.set(question._id.toString().toLowerCase(), question.text);
    }
    
    // Get all distinct question IDs from events
    const eventQuestionIds = await db.collection('events')
      .distinct('context.questionId', { type: 'question' });
    console.log(`Found ${eventQuestionIds.length} distinct question IDs in events`);
    
    // Check for matches
    let exactMatches = 0;
    let noMatches = 0;
    
    for (const eventId of eventQuestionIds) {
      const questionText = questionMap.get(eventId.toLowerCase());
      if (questionText) {
        exactMatches++;
        console.log(`Found match for event question ID: ${eventId}`);
        console.log(`Question text: ${questionText}`);
      } else {
        noMatches++;
      }
    }
    
    console.log(`Exact matches: ${exactMatches} (${((exactMatches / eventQuestionIds.length) * 100).toFixed(2)}%)`);
    console.log(`No matches: ${noMatches} (${((noMatches / eventQuestionIds.length) * 100).toFixed(2)}%)`);
    
    // Create an enhanced pipeline that uses string comparison for matching
    const enhancedPipeline = [
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
          _id: 0
        }
      },
      { $sort: { avgAttempts: -1 } }
    ];
    
    // Execute the pipeline to get the average attempts
    const results = await db.collection('events').aggregate(enhancedPipeline).toArray();
    console.log(`Query returned ${results.length} results`);
    
    // Enhance the results with question text
    const enhancedResults = results.map(result => {
      const questionText = questionMap.get(result.questionId.toLowerCase()) || 'Question text not available';
      return {
        ...result,
        questionText,
        hasMatch: questionText !== 'Question text not available',
        totalAttempts: Math.round(result.avgAttempts)
      };
    });
    
    // Print the enhanced results
    console.log('\nEnhanced Results:');
    enhancedResults.slice(0, 5).forEach((result, index) => {
      console.log(`Result ${index + 1}:`);
      console.log(`  Question ID: ${result.questionId}`);
      console.log(`  Question Text: ${result.questionText}`);
      console.log(`  Average Attempts: ${result.avgAttempts.toFixed(2)} (${result.totalAttempts} attempts on average)`);
      console.log('---');
    });
    
    // Calculate overall average
    const overallAvg = enhancedResults.reduce((sum, result) => sum + result.avgAttempts, 0) / enhancedResults.length;
    console.log(`Overall average attempts per question: ${overallAvg.toFixed(2)}`);
    
    // Count questions with text available
    const questionsWithText = enhancedResults.filter(r => r.hasMatch).length;
    console.log(`Questions with text available: ${questionsWithText} (${((questionsWithText / enhancedResults.length) * 100).toFixed(2)}%)`);
    
    // Create a modified version of our pipeline that includes the question text
    console.log('\nModified Pipeline:');
    console.log(`
// This pipeline uses a different approach to match question IDs
// It converts both the event question ID and the question ID to lowercase for comparison
[
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
  { $project: {
      questionId: 1,
      avgAttempts: 1,
      questionText: {
        $ifNull: [
          { $arrayElemAt: ['$questionDetails.text', 0] },
          'Question text not available'
        ]
      },
      totalAttempts: { $round: ['$avgAttempts', 0] }
    }
  },
  { $sort: { avgAttempts: -1 } }
]`);
    
    // Close the connection
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
    
    return enhancedResults;
  } catch (error) {
    console.error('Error:', error);
  }
}

updateRelationshipQuery();
