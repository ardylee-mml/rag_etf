require('dotenv').config();
const mongoose = require('mongoose');

async function fixRelationshipQuerySolution() {
  try {
    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Get the database
    const db = mongoose.connection.db;
    
    console.log('Testing the fixed relationship query...');
    
    // This is the modified pipeline that should work even without matching question IDs
    const fixedPipeline = [
      {
        $match: {
          type: 'question'  // Correctly filter for question events
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
      // Skip the $unwind stage since it fails when there are no matches
      // Instead, use a $project stage to include the related data if it exists
      {
        $project: {
          event_id: '$_id',
          player_id: '$playerId',
          question_id: '$context.questionId',
          correct: '$correct',
          timeTaken: '$timeTaken',
          type: '$type',
          // Include related question data if available, otherwise null
          question_text: { $cond: { if: { $gt: [{ $size: '$related' }, 0] }, then: { $arrayElemAt: ['$related.text', 0] }, else: null } }
        }
      },
      // Limit to 20 results for testing
      { $limit: 20 }
    ];
    
    console.log('Executing fixed pipeline on events collection...');
    console.log('Pipeline:', JSON.stringify(fixedPipeline, null, 2));
    
    // Execute the pipeline
    const results = await db.collection('events').aggregate(fixedPipeline).toArray();
    
    console.log(`Query returned ${results.length} results`);
    
    if (results.length > 0) {
      console.log('Sample results:');
      results.slice(0, 5).forEach((result, index) => {
        console.log(`Result ${index + 1}:`, JSON.stringify(result, null, 2));
      });
    }
    
    // Now let's try to calculate the average number of times players need to answer questions
    console.log('\nCalculating average number of times players answer questions...');
    
    const avgPipeline = [
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
      },
      {
        $limit: 10
      }
    ];
    
    console.log('Average attempts pipeline:', JSON.stringify(avgPipeline, null, 2));
    
    const avgResults = await db.collection('events').aggregate(avgPipeline).toArray();
    
    console.log(`Average attempts query returned ${avgResults.length} results`);
    
    if (avgResults.length > 0) {
      console.log('Average attempts per question:');
      avgResults.forEach(result => {
        console.log(`Question ID: ${result.questionId}, Average Attempts: ${result.avgAttempts.toFixed(2)}`);
      });
      
      // Calculate overall average
      const overallAvg = avgResults.reduce((sum, result) => sum + result.avgAttempts, 0) / avgResults.length;
      console.log(`Overall average attempts per question: ${overallAvg.toFixed(2)}`);
    }
    
    // Close the connection
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
  } catch (error) {
    console.error('Error:', error);
  }
}

fixRelationshipQuerySolution();
