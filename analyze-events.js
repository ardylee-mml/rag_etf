require('dotenv').config();
const mongoose = require('mongoose');

async function analyzeEvents() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB successfully');
    
    const db = mongoose.connection.db;
    const eventsCollection = db.collection('events');
    
    // Get event types distribution
    const eventTypesResult = await eventsCollection.aggregate([
      { $group: { _id: "$type", count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]).toArray();
    
    console.log('\n=== EVENT TYPES DISTRIBUTION ===');
    eventTypesResult.forEach(type => {
      console.log(`${type._id}: ${type.count} (${((type.count / 10929576) * 100).toFixed(2)}%)`);
    });
    
    // Get top 10 players with most events
    const topPlayersResult = await eventsCollection.aggregate([
      { $group: { _id: "$playerId", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]).toArray();
    
    console.log('\n=== TOP 10 PLAYERS BY EVENT COUNT ===');
    topPlayersResult.forEach((player, index) => {
      console.log(`${index + 1}. Player ${player._id}: ${player.count} events`);
    });
    
    // Get event distribution over time (by month)
    const timeDistributionResult = await eventsCollection.aggregate([
      { 
        $project: {
          yearMonth: { $substr: ["$time", 0, 7] }
        }
      },
      { $group: { _id: "$yearMonth", count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]).toArray();
    
    console.log('\n=== EVENT DISTRIBUTION BY MONTH ===');
    timeDistributionResult.forEach(month => {
      console.log(`${month._id}: ${month.count} events`);
    });
    
    // Sample specific event types to understand their structure
    const eventTypes = eventTypesResult.slice(0, 5).map(type => type._id);
    
    console.log('\n=== SAMPLE EVENTS BY TYPE ===');
    for (const eventType of eventTypes) {
      const sample = await eventsCollection.findOne({ type: eventType });
      console.log(`\nEvent Type: ${eventType}`);
      console.log(JSON.stringify(sample, null, 2));
    }
    
    // Close the connection
    mongoose.connection.close();
    console.log('\nConnection closed');
  } catch (err) {
    console.error('Error analyzing events:', err);
    if (mongoose.connection) {
      mongoose.connection.close();
    }
  }
}

analyzeEvents();
