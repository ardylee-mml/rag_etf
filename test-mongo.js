require('dotenv').config();
const mongoose = require('mongoose');

console.log('MongoDB URI:', process.env.MONGODB_URI);

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('Connected to MongoDB');
    
    // Get a list of collections
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    
    console.log('Collections:');
    collections.forEach(collection => {
      console.log(`- ${collection.name}`);
    });
    
    // Get a sample from the events collection
    const eventsCollection = db.collection('events');
    const eventsSample = await eventsCollection.find().limit(1).toArray();
    
    console.log('\nEvents Sample:');
    console.log(JSON.stringify(eventsSample, null, 2));
    
    // Close the connection
    await mongoose.connection.close();
    console.log('Connection closed');
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });
