require('dotenv').config();
const mongoose = require('mongoose');

async function testQuestionCount() {
  try {
    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Get the database
    const db = mongoose.connection.db;
    
    // Get all questions
    console.log('Getting questions...');
    const questions = await db.collection('questions').find({}).toArray();
    console.log(`Found ${questions.length} questions`);
    
    // Create a mapping from question ID to question text
    const questionMap = {};
    questions.forEach(q => {
      if (q._id) {
        questionMap[q._id.toString()] = q.text || null;
      }
    });
    console.log(`Created mapping for ${Object.keys(questionMap).length} questions`);
    
    // Create a pipeline to count question answers
    const pipeline = [
      { $match: { type: "question" } },
      { $group: { 
          _id: "$context.questionId", 
          count: { $sum: 1 } 
        } 
      },
      { $sort: { count: -1 } }
    ];
    
    // Execute the pipeline
    console.log('Executing pipeline...');
    const questionCounts = await db.collection('events').aggregate(pipeline).toArray();
    console.log(`Found ${questionCounts.length} question answer counts`);
    
    // Create the final results
    const finalResults = [];
    
    // Add question text to the counts
    for (const result of questionCounts) {
      const questionId = result._id;
      finalResults.push({
        questionId: questionId,
        count: result.count,
        questionText: questionMap[questionId] || null
      });
    }
    
    console.log(`Created ${finalResults.length} final results`);
    
    // Print the first 5 results
    console.log('First 5 results:');
    console.log(JSON.stringify(finalResults.slice(0, 5), null, 2));
    
    // Print the total count
    const totalCount = finalResults.reduce((sum, result) => sum + result.count, 0);
    console.log(`Total question answers: ${totalCount}`);
    
    // Close the connection
    await mongoose.connection.close();
    console.log('Connection closed');
  } catch (error) {
    console.error('Error:', error);
  }
}

testQuestionCount();
