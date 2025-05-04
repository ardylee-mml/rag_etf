require('dotenv').config();
const mongoose = require('mongoose');

async function examineQuestions() {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb+srv://mmluser-ro:1wzBCKHp2hBMCi69@clustermetamindinglab.qa8tyi1.mongodb.net/mmldb?retryWrites=true&w=majority';
    console.log('Connecting to MongoDB...');
    
    await mongoose.connect(mongoURI);
    console.log('MongoDB connected successfully');
    
    // Get the database
    const db = mongoose.connection.db;
    
    // Get the questions collection
    const questionsCollection = db.collection('questions');
    
    // Count total questions
    const totalQuestions = await questionsCollection.countDocuments();
    console.log(`Total questions in collection: ${totalQuestions}`);
    
    // Get a sample question
    const sampleQuestion = await questionsCollection.findOne({});
    console.log('\nSample question structure:');
    console.log(JSON.stringify(sampleQuestion, null, 2));
    
    // Check the _id field type
    console.log('\n_id field type:', typeof sampleQuestion._id);
    console.log('_id value:', sampleQuestion._id);
    console.log('_id toString():', sampleQuestion._id.toString());
    console.log('_id length:', sampleQuestion._id.toString().length);
    
    // Check if there are any string IDs
    const stringIdQuestion = await questionsCollection.findOne({ _id: { $type: 'string' } });
    console.log('\nQuestion with string _id:', stringIdQuestion ? 'Found' : 'Not found');
    
    if (stringIdQuestion) {
      console.log(JSON.stringify(stringIdQuestion, null, 2));
    }
    
    // Now let's check the events collection for question events
    const eventsCollection = db.collection('events');
    
    // Find a question event
    const questionEvent = await eventsCollection.findOne({ type: 'question' });
    console.log('\nSample question event:');
    console.log(JSON.stringify(questionEvent, null, 2));
    
    // Check the questionId field
    if (questionEvent && questionEvent.context && questionEvent.context.questionId) {
      console.log('\nquestionId field type:', typeof questionEvent.context.questionId);
      console.log('questionId value:', questionEvent.context.questionId);
      console.log('questionId length:', questionEvent.context.questionId.length);
      
      // Try to find this question in the questions collection
      const matchingQuestion = await questionsCollection.findOne({ _id: questionEvent.context.questionId });
      console.log('\nMatching question by direct ID:', matchingQuestion ? 'Found' : 'Not found');
      
      // Try with ObjectId
      try {
        const objectIdQuestion = await questionsCollection.findOne({ _id: new mongoose.Types.ObjectId(questionEvent.context.questionId) });
        console.log('Matching question by ObjectId:', objectIdQuestion ? 'Found' : 'Not found');
      } catch (error) {
        console.log('Error converting to ObjectId:', error.message);
      }
      
      // Try with string comparison
      const stringComparisonQuestion = await questionsCollection.findOne({ 
        $expr: { $eq: [{ $toString: "$_id" }, questionEvent.context.questionId] } 
      });
      console.log('Matching question by string comparison:', stringComparisonQuestion ? 'Found' : 'Not found');
      
      if (stringComparisonQuestion) {
        console.log(JSON.stringify(stringComparisonQuestion, null, 2));
      }
    }
    
    // Check if there's any other field that might contain the question text
    console.log('\nChecking for alternative question text fields in events:');
    if (questionEvent && questionEvent.context) {
      const contextKeys = Object.keys(questionEvent.context);
      console.log('Context fields:', contextKeys);
      
      // Check if any of these fields might contain question text
      for (const key of contextKeys) {
        if (typeof questionEvent.context[key] === 'string' && 
            questionEvent.context[key].length > 10 && 
            key !== 'questionId') {
          console.log(`Potential question text field: ${key}`);
          console.log(`Value: ${questionEvent.context[key]}`);
        }
      }
    }
    
    // Try to find a direct relationship between events and questions
    console.log('\nTrying to find a relationship between events and questions:');
    
    // Get all question IDs from events
    const questionIds = await eventsCollection.distinct('context.questionId', { type: 'question' });
    console.log(`Found ${questionIds.length} distinct question IDs in events`);
    
    if (questionIds.length > 0) {
      console.log('Sample question IDs from events:');
      console.log(questionIds.slice(0, 5));
      
      // Try to find any questions that match these IDs
      const matchingQuestions = await questionsCollection.find({ 
        $or: [
          { _id: { $in: questionIds.slice(0, 10) } },
          { questionId: { $in: questionIds.slice(0, 10) } }
        ]
      }).toArray();
      
      console.log(`Found ${matchingQuestions.length} matching questions`);
      
      if (matchingQuestions.length > 0) {
        console.log('Sample matching question:');
        console.log(JSON.stringify(matchingQuestions[0], null, 2));
      }
    }
    
    // Check if there's a different field in questions that might match with events
    console.log('\nChecking for alternative ID fields in questions:');
    const questionFields = Object.keys(sampleQuestion);
    console.log('Question fields:', questionFields);
    
    for (const field of questionFields) {
      if (field.includes('id') || field.includes('Id')) {
        console.log(`Potential ID field: ${field}`);
        console.log(`Value: ${sampleQuestion[field]}`);
        
        // Check if this field matches any question IDs in events
        if (questionIds && questionIds.includes(sampleQuestion[field])) {
          console.log(`Found a match! Field ${field} matches event questionId`);
        }
      }
    }
    
  } catch (error) {
    console.error('Error examining questions:', error);
  } finally {
    // Close the connection
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
  }
}

// Run the function
examineQuestions();
