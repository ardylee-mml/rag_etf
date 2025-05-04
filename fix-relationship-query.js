require('dotenv').config();
const mongoose = require('mongoose');

async function fixRelationshipQuery() {
  try {
    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Get the database
    const db = mongoose.connection.db;

    // Test the query that's failing
    console.log('Testing the relationship query that is failing...');

    // This is the pipeline that should be used
    const pipeline = [
      {
        $match: {
          type: 'question'  // This is the key part that seems to be missing or not working
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
        $unwind: '$related'
      },
      {
        $project: {
          event_id: '$_id',
          player_id: '$playerId',
          question_id: '$context.questionId',
          correct: '$correct',
          timeTaken: '$timeTaken',
          type: '$type'  // Include type in the projection to verify filtering
        }
      }
    ];

    console.log('Executing pipeline on events collection...');
    console.log('Pipeline:', JSON.stringify(pipeline, null, 2));

    // Execute the pipeline
    const results = await db.collection('events').aggregate(pipeline).toArray();

    console.log(`Query returned ${results.length} results`);

    // Check if the results contain only events with type 'question'
    const typeCheck = results.every(result => result.type === 'question');
    console.log(`All results have type 'question': ${typeCheck}`);

    if (results.length > 0) {
      console.log('Sample result:');
      console.log(JSON.stringify(results[0], null, 2));
    }

    // Check if there are any events with type 'question' in the database
    const questionCount = await db.collection('events').countDocuments({ type: 'question' });
    console.log(`Total events with type 'question': ${questionCount}`);

    // Check a sample event with type 'question'
    if (questionCount > 0) {
      console.log('Sample event with type "question":');
      const sampleEvent = await db.collection('events').findOne({ type: 'question' });
      console.log(JSON.stringify(sampleEvent, null, 2));

      // Check if this event has a valid questionId
      if (sampleEvent.context && sampleEvent.context.questionId) {
        console.log('Checking if the questionId exists in the questions collection...');
        const questionId = sampleEvent.context.questionId;
        const question = await db.collection('questions').findOne({ _id: questionId });
        console.log(`Question found: ${question !== null}`);
        if (question) {
          console.log('Sample question:');
          console.log(JSON.stringify(question, null, 2));
        } else {
          console.log('The questionId does not exist in the questions collection.');
          console.log('This might be the issue with the relationship lookup.');
        }
      } else {
        console.log('The event does not have a context.questionId field.');
        console.log('This might be the issue with the relationship lookup.');
      }
    }

    // If there are no events with type 'question', check what types exist
    if (questionCount === 0) {
      console.log('No events with type "question" found. Checking available event types...');
      const types = await db.collection('events').distinct('type');
      console.log('Available event types:', types);

      // Check if there are events with type 'QUESTION_ANSWER' (the old type)
      const oldTypeCount = await db.collection('events').countDocuments({ type: 'QUESTION_ANSWER' });
      console.log(`Total events with type 'QUESTION_ANSWER': ${oldTypeCount}`);

      if (oldTypeCount > 0) {
        console.log('Found events with old type "QUESTION_ANSWER". This might be the issue.');
        console.log('Sample event with type QUESTION_ANSWER:');
        const sampleOldEvent = await db.collection('events').findOne({ type: 'QUESTION_ANSWER' });
        console.log(JSON.stringify(sampleOldEvent, null, 2));
      }
    }

    // Try a simpler pipeline without the $unwind stage
    console.log('\nTrying a simpler pipeline without $unwind...');
    const simplePipeline = [
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
          related_count: { $size: '$related' }
        }
      }
    ];

    console.log('Pipeline:', JSON.stringify(simplePipeline, null, 2));
    const simpleResults = await db.collection('events').aggregate(simplePipeline).toArray();
    console.log(`Query returned ${simpleResults.length} results`);

    if (simpleResults.length > 0) {
      console.log('Sample result:');
      console.log(JSON.stringify(simpleResults[0], null, 2));

      // Check how many events have related questions
      const eventsWithQuestions = simpleResults.filter(r => r.related_count > 0).length;
      console.log(`Events with related questions: ${eventsWithQuestions} out of ${simpleResults.length}`);
    }

    // Close the connection
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
  } catch (error) {
    console.error('Error:', error);
  }
}

fixRelationshipQuery();
