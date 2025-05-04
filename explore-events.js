require('dotenv').config();
const mongoose = require('mongoose');

// Connect to MongoDB
async function exploreEventsCollection() {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb+srv://mmluser-ro:1wzBCKHp2hBMCi69@clustermetamindinglab.qa8tyi1.mongodb.net/mmldb?retryWrites=true&w=majority';
    console.log('Connecting to MongoDB...');
    
    await mongoose.connect(mongoURI);
    console.log('MongoDB connected successfully');
    
    // Get the database
    const db = mongoose.connection.db;
    
    // Get the events collection
    const eventsCollection = db.collection('events');
    
    // 1. Count total events
    const totalEvents = await eventsCollection.countDocuments();
    console.log(`Total events in collection: ${totalEvents}`);
    
    // 2. Find distinct event types
    const eventTypes = await eventsCollection.distinct('type');
    console.log('\nDistinct event types:');
    eventTypes.forEach(type => console.log(`- ${type}`));
    
    // 3. Count events by type
    console.log('\nEvent counts by type:');
    for (const type of eventTypes) {
      const count = await eventsCollection.countDocuments({ type });
      console.log(`${type}: ${count}`);
    }
    
    // 4. Examine the structure of different event types
    console.log('\nExamining event structure for each type:');
    for (const type of eventTypes.slice(0, 10)) { // Limit to first 10 types to avoid too much output
      const sample = await eventsCollection.findOne({ type });
      console.log(`\n${type} event structure:`);
      console.log(JSON.stringify(sample, null, 2));
      
      // Check for context field
      if (sample.context) {
        console.log(`\nContext fields for ${type}:`);
        console.log(Object.keys(sample.context));
      }
    }
    
    // 5. Look for events related to questions
    console.log('\nSearching for events related to questions:');
    const questionRelatedEvents = await eventsCollection.find({
      $or: [
        { type: { $regex: /QUESTION/i } },
        { 'context.questionId': { $exists: true } },
        { 'context.question': { $exists: true } }
      ]
    }).limit(5).toArray();
    
    if (questionRelatedEvents.length > 0) {
      console.log(`Found ${questionRelatedEvents.length} question-related events`);
      console.log(JSON.stringify(questionRelatedEvents[0], null, 2));
    } else {
      console.log('No question-related events found');
      
      // Try a broader search
      console.log('\nTrying broader search for question-related content:');
      const textSearch = await eventsCollection.find({
        $or: [
          { type: { $regex: /QUIZ|ANSWER|TEST|SURVEY/i } },
          { $text: { $search: "question answer quiz test" } }
        ]
      }).limit(5).toArray();
      
      if (textSearch.length > 0) {
        console.log(`Found ${textSearch.length} potentially related events`);
        console.log(JSON.stringify(textSearch[0], null, 2));
      } else {
        console.log('No potentially related events found');
      }
    }
    
    // 6. Check for any events with a 'context' field that might contain question data
    console.log('\nChecking for events with context field:');
    const eventsWithContext = await eventsCollection.find({
      'context': { $exists: true, $ne: {} }
    }).limit(10).toArray();
    
    if (eventsWithContext.length > 0) {
      console.log(`Found ${eventsWithContext.length} events with context field`);
      
      // Analyze context fields
      const contextFields = new Set();
      eventsWithContext.forEach(event => {
        if (event.context) {
          Object.keys(event.context).forEach(key => contextFields.add(key));
        }
      });
      
      console.log('\nContext fields found:');
      console.log(Array.from(contextFields));
      
      // Show a sample event with context
      console.log('\nSample event with context:');
      console.log(JSON.stringify(eventsWithContext[0], null, 2));
    } else {
      console.log('No events with context field found');
    }
    
  } catch (error) {
    console.error('Error exploring events collection:', error);
  } finally {
    // Close the connection
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
  }
}

// Run the function
exploreEventsCollection();
