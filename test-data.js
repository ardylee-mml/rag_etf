require('dotenv').config();
const mongoose = require('mongoose');

// Connect to MongoDB
async function connectToMongoDB() {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb+srv://mmluser-ro:1wzBCKHp2hBMCi69@clustermetamindinglab.qa8tyi1.mongodb.net/mmldb?retryWrites=true&w=majority';
    console.log('Connecting to MongoDB...');
    console.log('MongoDB URI:', mongoURI);

    await mongoose.connect(mongoURI);
    console.log('MongoDB connected successfully');

    // Get the database
    const db = mongoose.connection.db;

    // Check collections
    const collections = await db.listCollections().toArray();
    console.log('Available collections:');
    collections.forEach(collection => {
      console.log(`- ${collection.name}`);
    });

    // Check if there's data in the events collection
    const eventsCount = await db.collection('events').countDocuments();
    console.log(`Total events: ${eventsCount}`);

    // Check if there are question events
    const questionAnswerCount = await db.collection('events').countDocuments({ type: 'question' });
    console.log(`Question events: ${questionAnswerCount}`);

    // Check if there's data in the questions collection
    const questionsCount = await db.collection('questions').countDocuments();
    console.log(`Total questions: ${questionsCount}`);

    // Get a sample of events with type question
    if (questionAnswerCount > 0) {
      const sampleEvents = await db.collection('events')
        .find({ type: 'question' })
        .limit(3)
        .toArray();

      console.log('Sample question events:');
      console.log(JSON.stringify(sampleEvents, null, 2));

      // Check if these events have context.questionId
      const hasQuestionId = sampleEvents.some(event => event.context && event.context.questionId);
      console.log(`Events have context.questionId: ${hasQuestionId}`);

      if (hasQuestionId) {
        // Get a sample question
        const questionId = sampleEvents.find(event => event.context && event.context.questionId).context.questionId;
        const question = await db.collection('questions').findOne({ _id: questionId });
        console.log('Sample question:');
        console.log(JSON.stringify(question, null, 2));
      }
    }

    // Test the aggregation pipeline
    console.log('\nTesting aggregation pipeline:');
    const pipeline = [
      { $match: { type: 'question' } },
      { $group: {
        _id: '$context.questionId',
        count: { $sum: 1 }
      }},
      { $lookup: {
        from: 'questions',
        localField: '_id',
        foreignField: '_id',
        as: 'questionDetails'
      }},
      { $unwind: { path: '$questionDetails', preserveNullAndEmptyArrays: true } },
      { $project: {
        questionId: '$_id',
        questionText: '$questionDetails.text',
        count: 1,
        _id: 0
      }},
      { $sort: { count: -1 } }
    ];

    const results = await db.collection('events').aggregate(pipeline).toArray();
    console.log(`Aggregation results count: ${results.length}`);
    console.log('Aggregation results:');
    console.log(JSON.stringify(results, null, 2));

  } catch (error) {
    console.error('MongoDB connection error:', error);
  } finally {
    // Close the connection
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
  }
}

// Run the function
connectToMongoDB();
