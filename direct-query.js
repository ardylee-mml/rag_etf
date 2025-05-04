require('dotenv').config();
const mongoose = require('mongoose');

async function runDirectQuery() {
  try {
    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Get the database
    const db = mongoose.connection.db;
    
    // Define the pipeline for "what is the percentage of players played more than 3 times?"
    const pipeline = [
      // Group events by player to count how many times each player played
      { 
        $group: {
          _id: "$playerId",
          playCount: { $sum: 1 }
        }
      },
      
      // Add a field to identify players who played more than 3 times
      {
        $addFields: {
          playedMoreThanThreeTimes: { $gt: ["$playCount", 3] }
        }
      },
      
      // Group all results to calculate percentages
      {
        $group: {
          _id: null,
          totalPlayers: { $sum: 1 },
          playersMoreThanThreeTimes: { 
            $sum: { $cond: [{ $eq: ["$playedMoreThanThreeTimes", true] }, 1, 0] }
          }
        }
      },
      
      // Calculate the percentage
      {
        $project: {
          _id: 0,
          totalPlayers: 1,
          playersMoreThanThreeTimes: 1,
          percentage: { 
            $multiply: [
              { $divide: ["$playersMoreThanThreeTimes", "$totalPlayers"] },
              100
            ]
          }
        }
      }
    ];
    
    console.log('Running query...');
    console.log(JSON.stringify(pipeline, null, 2));
    
    // Execute the query
    const result = await db.collection('events').aggregate(pipeline).toArray();
    
    console.log('Query result:');
    console.log(JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Close the connection
    await mongoose.connection.close();
    console.log('Connection closed');
  }
}

runDirectQuery();
