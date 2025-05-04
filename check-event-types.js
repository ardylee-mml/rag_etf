require('dotenv').config();
const mongoose = require('mongoose');

async function checkEventTypes() {
  try {
    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Get the database
    const db = mongoose.connection.db;
    
    // Get all distinct event types
    console.log('Getting event types...');
    const eventTypes = await db.collection('events').distinct('type');
    console.log('Event types:');
    console.log(eventTypes);
    
    // Count events of each type
    console.log('\nCounting events of each type:');
    for (const type of eventTypes) {
      const count = await db.collection('events').countDocuments({ type });
      console.log(`${type}: ${count}`);
    }
    
    // Check for events with questionId
    console.log('\nChecking for events with questionId...');
    const questionEvents = await db.collection('events').find({
      'context.questionId': { $exists: true }
    }).limit(5).toArray();
    
    console.log(`Found ${questionEvents.length} events with questionId`);
    if (questionEvents.length > 0) {
      console.log('Sample event:');
      console.log(JSON.stringify(questionEvents[0], null, 2));
    }
    
    // Close the connection
    await mongoose.connection.close();
    console.log('Connection closed');
  } catch (error) {
    console.error('Error:', error);
  }
}

checkEventTypes();
