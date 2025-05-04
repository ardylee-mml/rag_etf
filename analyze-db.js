require('dotenv').config();
const mongoose = require('mongoose');

async function analyzeDatabase() {
  try {
    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Get the database
    const db = mongoose.connection.db;
    
    // Get all collections
    const collections = await db.listCollections().toArray();
    console.log(`Found ${collections.length} collections:`);
    
    // Analyze each collection
    for (const collectionInfo of collections) {
      const collectionName = collectionInfo.name;
      console.log(`\n=== Collection: ${collectionName} ===`);
      
      // Get collection
      const collection = db.collection(collectionName);
      
      // Get count
      const count = await collection.countDocuments();
      console.log(`Documents count: ${count}`);
      
      if (count > 0) {
        // Get a sample document
        const sampleDoc = await collection.findOne();
        console.log('Sample document structure:');
        console.log(JSON.stringify(sampleDoc, null, 2));
        
        // Get field names from the sample document
        const fields = Object.keys(sampleDoc);
        console.log(`Fields: ${fields.join(', ')}`);
        
        // If there's a context field, analyze it further
        if (sampleDoc.context && typeof sampleDoc.context === 'object') {
          console.log('Context field structure:');
          console.log(JSON.stringify(sampleDoc.context, null, 2));
        }
      }
    }
    
    console.log('\nDatabase analysis complete');
  } catch (error) {
    console.error('Error analyzing database:', error);
  } finally {
    // Close the connection
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
  }
}

// Run the analysis
analyzeDatabase();
