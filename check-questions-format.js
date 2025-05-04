require('dotenv').config();
const mongoose = require('mongoose');
const { ObjectId } = require('mongodb');

async function checkQuestionsFormat() {
  try {
    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Get the database
    const db = mongoose.connection.db;
    
    // Get a sample question
    const sampleQuestion = await db.collection('questions').findOne();
    console.log('Sample question:');
    console.log(JSON.stringify(sampleQuestion, null, 2));
    console.log('Question ID type:', typeof sampleQuestion._id);
    console.log('Question ID constructor:', sampleQuestion._id.constructor.name);
    console.log('Question ID value:', sampleQuestion._id.toString());
    
    // Get a sample event with a question
    const sampleEvent = await db.collection('events').findOne({ type: 'question' });
    console.log('\nSample event:');
    console.log(JSON.stringify(sampleEvent, null, 2));
    console.log('Event question ID type:', typeof sampleEvent.context.questionId);
    console.log('Event question ID value:', sampleEvent.context.questionId);
    
    // Try to find a question using the event's question ID
    console.log('\nTrying different ways to match the question ID:');
    
    // Method 1: Direct match
    const directMatch = await db.collection('questions').findOne({ _id: sampleEvent.context.questionId });
    console.log('Direct match:', directMatch ? 'Found' : 'Not found');
    
    // Method 2: String comparison
    const stringMatch = await db.collection('questions').findOne({ _id: sampleEvent.context.questionId.toString() });
    console.log('String match:', stringMatch ? 'Found' : 'Not found');
    
    // Method 3: Try to convert to ObjectId
    try {
      const objectIdMatch = await db.collection('questions').findOne({ _id: new ObjectId(sampleEvent.context.questionId) });
      console.log('ObjectId match:', objectIdMatch ? 'Found' : 'Not found');
    } catch (error) {
      console.log('ObjectId match: Error -', error.message);
    }
    
    // Method 4: Check if any question ID matches the event question ID as string
    const allQuestionIds = await db.collection('questions').distinct('_id');
    const matchingIds = allQuestionIds.filter(id => id.toString() === sampleEvent.context.questionId);
    console.log('Matching IDs by string comparison:', matchingIds.length);
    
    if (matchingIds.length > 0) {
      console.log('Matching ID:', matchingIds[0]);
      const matchedQuestion = await db.collection('questions').findOne({ _id: matchingIds[0] });
      console.log('Matched question:', matchedQuestion ? matchedQuestion.text : 'Not found');
    }
    
    // Close the connection
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
  } catch (error) {
    console.error('Error:', error);
  }
}

checkQuestionsFormat();
