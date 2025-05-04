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
      
      // Build a simple aggregation pipeline manually
      const query = 'Find players from CA region';
      const pipeline = [
        {
          $match: {
            region: 'CA'
          }
        },
        {
          $limit: 5
        }
      ];
      
      console.log('Executing query:', query);
      console.log('Pipeline:', JSON.stringify(pipeline, null, 2));
      
      // Execute the aggregation
      const results = await collection.aggregate(pipeline).toArray();
      
      console.log(`Found ${results.length} results:`);
      console.log(JSON.stringify(results, null, 2));
      
      // Close the connection
      mongoose.connection.close();
      console.log('Connection closed');
    } catch (err) {
      console.error('Error executing query:', err);
      mongoose.connection.close();
    }
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
  });
