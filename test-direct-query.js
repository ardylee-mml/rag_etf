require('dotenv').config();
const mongoose = require('mongoose');

console.log('MongoDB URI:', process.env.MONGODB_URI);

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('Connected to MongoDB successfully');
    
    try {
      // Get all collections
      const collections = await mongoose.connection.db.listCollections().toArray();
      console.log('Available collections:');
      collections.forEach(collection => {
        console.log(`- ${collection.name}`);
      });
      
      // Try to access the mmldb collection
      const db = mongoose.connection.db;
      const collection = db.collection('mmldb');
      
      // Create a text index on all fields
      try {
        await collection.createIndex({ "$**": "text" });
        console.log('Created text index on all fields');
      } catch (indexError) {
        console.error('Error creating text index:', indexError);
      }
      
      // Count documents in the collection
      const count = await collection.countDocuments();
      console.log(`Number of documents in mmldb collection: ${count}`);
      
      // Insert a test document if the collection is empty
      if (count === 0) {
        const result = await collection.insertOne({
          title: 'Test Document',
          content: 'This is a test document for MongoDB RAG API',
          createdAt: new Date()
        });
        console.log('Inserted test document:', result);
      }
      
      // Get all documents
      const documents = await collection.find({}).toArray();
      console.log('Documents in mmldb collection:');
      console.log(JSON.stringify(documents, null, 2));
      
      // Close the connection
      mongoose.connection.close();
      console.log('Connection closed');
    } catch (err) {
      console.error('Error accessing mmldb collection:', err);
      mongoose.connection.close();
    }
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
  });
