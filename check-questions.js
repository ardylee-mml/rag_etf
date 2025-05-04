require('dotenv').config();
const mongoose = require('mongoose');

async function checkQuestions() {
  try {
    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Get the database
    const db = mongoose.connection.db;
    
    // Check if there are any questions in the questions collection
    const questionsCount = await db.collection('questions').countDocuments();
    console.log(`Total questions in the questions collection: ${questionsCount}`);
    
    if (questionsCount > 0) {
      // Get a sample question
      const sampleQuestion = await db.collection('questions').findOne();
      console.log('Sample question:');
      console.log(JSON.stringify(sampleQuestion, null, 2));
      
      // Check if any of the question IDs from our events match
      const eventQuestionIds = await db.collection('events')
        .distinct('context.questionId', { type: 'question' });
      console.log(`Distinct question IDs in events: ${eventQuestionIds.length}`);
      
      if (eventQuestionIds.length > 0) {
        console.log('Sample question IDs from events:');
        eventQuestionIds.slice(0, 5).forEach(id => console.log(`  ${id}`));
        
        // Check if any of these IDs exist in the questions collection
        const matchingQuestions = await db.collection('questions')
          .find({ _id: { $in: eventQuestionIds.slice(0, 10) } })
          .toArray();
        
        console.log(`Questions matching event question IDs: ${matchingQuestions.length}`);
        
        if (matchingQuestions.length > 0) {
          console.log('Matching questions:');
          matchingQuestions.forEach(q => console.log(`  ${q._id}: ${q.text}`));
        } else {
          console.log('No matching questions found.');
          
          // Check the ID format
          console.log('\nChecking ID format:');
          const sampleEventQuestionId = eventQuestionIds[0];
          const sampleQuestionId = sampleQuestion._id;
          
          console.log(`Event question ID: ${sampleEventQuestionId} (${typeof sampleEventQuestionId})`);
          console.log(`Question ID: ${sampleQuestionId} (${typeof sampleQuestionId})`);
          
          // If the types are different, this might be the issue
          if (typeof sampleEventQuestionId !== typeof sampleQuestionId) {
            console.log('ID types are different! This is likely the cause of the issue.');
            console.log('You may need to convert the IDs to the same format.');
          }
        }
      }
    } else {
      console.log('No questions found in the questions collection.');
    }
    
    // Close the connection
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
  } catch (error) {
    console.error('Error:', error);
  }
}

checkQuestions();
