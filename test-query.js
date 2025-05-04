require('dotenv').config();
const mongoose = require('mongoose');

async function testQuery() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to database:', mongoose.connection.db.databaseName);
    
    // Test a simple query first
    const simpleResult = await mongoose.connection.db.collection('events').aggregate([
      { $match: { type: { $in: ['signin', 'signout'] } } },
      { $limit: 5 }
    ]).toArray();
    
    console.log('Simple query result:', JSON.stringify(simpleResult, null, 2));
    
    // Now test the full query
    const fullQuery = [
      { $match: { type: { $in: ['signin', 'signout'] } } },
      { $sort: { playerId: 1, time: 1 } },
      { $group: {
          _id: '$playerId',
          events: { 
            $push: { 
              type: '$type', 
              time: '$time' 
            } 
          }
        }
      },
      { $addFields: {
          sessionTimes: {
            $reduce: {
              input: { $range: [0, { $subtract: [{ $size: '$events' }, 1] }] },
              initialValue: [],
              in: {
                $concatArrays: [
                  '$$value',
                  {
                    $cond: {
                      if: {
                        $and: [
                          { $eq: [{ $arrayElemAt: ['$events.type', '$$this'] }, 'signin'] },
                          { $eq: [{ $arrayElemAt: ['$events.type', { $add: ['$$this', 1] }] }, 'signout'] }
                        ]
                      },
                      then: [{
                        $subtract: [
                          { $arrayElemAt: ['$events.time', { $add: ['$$this', 1] }] },
                          { $arrayElemAt: ['$events.time', '$$this'] }
                        ]
                      }],
                      else: []
                    }
                  }
                ]
              }
            }
          }
        }
      },
      { $addFields: {
          totalPlayTime: { $sum: '$sessionTimes' },
          sessionCount: { $size: '$sessionTimes' },
          averageSessionTime: { 
            $cond: {
              if: { $gt: [{ $size: '$sessionTimes' }, 0] },
              then: { $divide: [{ $sum: '$sessionTimes' }, { $size: '$sessionTimes' }] },
              else: 0
            }
          }
        }
      },
      { $match: { sessionCount: { $gt: 0 } } },
      { $group: {
          _id: null,
          averagePlayTime: { $avg: '$averageSessionTime' },
          totalPlayers: { $sum: 1 },
          minPlayTime: { $min: '$averageSessionTime' },
          maxPlayTime: { $max: '$averageSessionTime' }
        }
      },
      { $project: {
          _id: 0,
          averagePlayTime: { $round: [{ $divide: ['$averagePlayTime', 1000] }, 2] },
          totalPlayers: 1,
          minPlayTime: { $round: [{ $divide: ['$minPlayTime', 1000] }, 2] },
          maxPlayTime: { $round: [{ $divide: ['$maxPlayTime', 1000] }, 2] },
          unit: { $literal: 'seconds' }
        }
      }
    ];
    
    try {
      const fullResult = await mongoose.connection.db.collection('events').aggregate(fullQuery).toArray();
      console.log('Full query result:', JSON.stringify(fullResult, null, 2));
    } catch (error) {
      console.error('Error executing full query:', error);
      
      // Try to identify which stage is causing the problem
      console.log('Testing query stages one by one...');
      
      for (let i = 1; i <= fullQuery.length; i++) {
        try {
          const partialQuery = fullQuery.slice(0, i);
          console.log(`Testing stages 1-${i}...`);
          const partialResult = await mongoose.connection.db.collection('events').aggregate(partialQuery).toArray();
          console.log(`Stages 1-${i} succeeded with ${partialResult.length} results`);
        } catch (stageError) {
          console.error(`Error at stage ${i}:`, stageError);
          break;
        }
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Connection closed');
  }
}

testQuery();
