require('dotenv').config();
const mongoose = require('mongoose');

console.log('MongoDB URI:', process.env.MONGODB_URI);

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('Connected to MongoDB successfully');
    
    try {
      // Access the players collection
      const db = mongoose.connection.db;
      const collection = db.collection('players');
      
      // Count documents in the collection
      const count = await collection.countDocuments();
      console.log(`Number of documents in players collection: ${count}`);
      
      // Get a sample document
      if (count > 0) {
        const sample = await collection.findOne({});
        console.log('Sample document:');
        console.log(JSON.stringify(sample, null, 2));
      }
      
      // Close the connection
      mongoose.connection.close();
      console.log('Connection closed');
    } catch (err) {
      console.error('Error accessing players collection:', err);
      mongoose.connection.close();
    }
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
  });
