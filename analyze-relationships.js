require('dotenv').config();
const mongoose = require('mongoose');

async function analyzeRelationships() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB successfully');
    
    const db = mongoose.connection.db;
    
    // Analyze events-players relationship
    const eventsCollection = db.collection('events');
    const playersCollection = db.collection('players');
    
    // Get a sample player
    const samplePlayer = await playersCollection.findOne({});
    console.log('\n=== PLAYER-EVENTS RELATIONSHIP ===');
    console.log('Sample player:');
    console.log(JSON.stringify(samplePlayer, null, 2));
    
    // Count events for this player
    const playerEvents = await eventsCollection.countDocuments({ 
      playerId: samplePlayer.playerId.toString() 
    });
    console.log(`Events for player ${samplePlayer.name} (ID: ${samplePlayer.playerId}): ${playerEvents}`);
    
    // Analyze events-items relationship
    const itemsCollection = db.collection('items');
    const sampleItem = await itemsCollection.findOne({});
    
    console.log('\n=== ITEM-EVENTS RELATIONSHIP ===');
    console.log('Sample item:');
    console.log(JSON.stringify(sampleItem, null, 2));
    
    // Count item events
    const itemEvents = await eventsCollection.countDocuments({ 
      type: 'item',
      'context.itemId': sampleItem._id
    });
    console.log(`Events for item ${sampleItem.name} (ID: ${sampleItem._id}): ${itemEvents}`);
    
    // Analyze events-zones relationship
    const zonesCollection = db.collection('zones');
    const sampleZone = await zonesCollection.findOne({});
    
    console.log('\n=== ZONE-EVENTS RELATIONSHIP ===');
    console.log('Sample zone:');
    console.log(JSON.stringify(sampleZone, null, 2));
    
    // Count zone events
    const zoneEvents = await eventsCollection.countDocuments({ 
      type: 'zone',
      'context.zoneId': sampleZone._id
    });
    console.log(`Events for zone ${sampleZone.name} (ID: ${sampleZone._id}): ${zoneEvents}`);
    
    // Analyze events-questions relationship
    const questionsCollection = db.collection('questions');
    const sampleQuestion = await questionsCollection.findOne({});
    
    console.log('\n=== QUESTION-EVENTS RELATIONSHIP ===');
    console.log('Sample question:');
    console.log(JSON.stringify(sampleQuestion, null, 2));
    
    // Count question events
    const questionEvents = await eventsCollection.countDocuments({ 
      type: 'question',
      'context.questionId': sampleQuestion._id
    });
    console.log(`Events for question "${sampleQuestion.text.substring(0, 50)}..." (ID: ${sampleQuestion._id}): ${questionEvents}`);
    
    // Analyze leaderboards-players relationship
    const leaderboardsCollection = db.collection('leaderboards');
    const sampleLeaderboard = await leaderboardsCollection.findOne({});
    
    console.log('\n=== LEADERBOARD-PLAYERS RELATIONSHIP ===');
    console.log('Sample leaderboard entry:');
    console.log(JSON.stringify(sampleLeaderboard, null, 2));
    
    // Get player for this leaderboard entry
    const leaderboardPlayer = await playersCollection.findOne({ 
      playerId: sampleLeaderboard.playerId 
    });
    
    if (leaderboardPlayer) {
      console.log(`Leaderboard entry for player: ${leaderboardPlayer.name} (ID: ${leaderboardPlayer.playerId})`);
    } else {
      console.log(`No player found for leaderboard entry with playerId: ${sampleLeaderboard.playerId}`);
    }
    
    // Close the connection
    mongoose.connection.close();
    console.log('\nConnection closed');
  } catch (err) {
    console.error('Error analyzing relationships:', err);
    if (mongoose.connection) {
      mongoose.connection.close();
    }
  }
}

analyzeRelationships();
