require('dotenv').config();
const mongoose = require('mongoose');

async function createQuestionMapping() {
  try {
    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Get the database
    const db = mongoose.connection.db;
    
    console.log('Creating question mapping...');
    
    // Get all questions
    const questions = await db.collection('questions').find().toArray();
    console.log(`Found ${questions.length} questions`);
    
    // Get all distinct question IDs from events
    const eventQuestionIds = await db.collection('events')
      .distinct('context.questionId', { type: 'question' });
    console.log(`Found ${eventQuestionIds.length} distinct question IDs in events`);
    
    // Create a mapping collection (drop it first if it exists)
    try {
      await db.collection('question_mapping').drop();
      console.log('Dropped existing question_mapping collection');
    } catch (error) {
      console.log('No existing question_mapping collection to drop');
    }
    
    // Create the mapping collection
    await db.createCollection('question_mapping');
    console.log('Created question_mapping collection');
    
    // Create a mapping between event question IDs and questions
    const mapping = [];
    
    // First, try exact string matching
    for (const question of questions) {
      const questionIdStr = question._id.toString();
      
      // Check if this question ID exists in events
      const matchingEventIds = eventQuestionIds.filter(id => id === questionIdStr);
      
      if (matchingEventIds.length > 0) {
        mapping.push({
          eventQuestionId: questionIdStr,
          questionId: question._id,
          questionText: question.text,
          matchType: 'exact'
        });
        console.log(`Found exact match for question ID: ${questionIdStr}`);
      }
    }
    
    // Next, try case-insensitive matching
    for (const question of questions) {
      const questionIdStr = question._id.toString().toLowerCase();
      
      // Check if this question ID exists in events (case-insensitive)
      const matchingEventIds = eventQuestionIds.filter(id => 
        id.toLowerCase() === questionIdStr && 
        !mapping.some(m => m.eventQuestionId === id)
      );
      
      if (matchingEventIds.length > 0) {
        for (const eventId of matchingEventIds) {
          mapping.push({
            eventQuestionId: eventId,
            questionId: question._id,
            questionText: question.text,
            matchType: 'case-insensitive'
          });
          console.log(`Found case-insensitive match for question ID: ${eventId} -> ${questionIdStr}`);
        }
      }
    }
    
    // Finally, try to match by looking for questions with the same ID format
    // This is a more complex approach that tries to match UUID patterns
    for (const eventId of eventQuestionIds) {
      // Skip if we already found a match
      if (mapping.some(m => m.eventQuestionId === eventId)) {
        continue;
      }
      
      // Try to find a question with a similar ID pattern
      // This is a simplified approach - in a real solution, you might use more sophisticated matching
      const similarQuestions = questions.filter(q => {
        const qIdStr = q._id.toString();
        // Check if the IDs have the same length and similar pattern
        return qIdStr.length === eventId.length && 
               qIdStr.split('-').length === eventId.split('-').length;
      });
      
      if (similarQuestions.length > 0) {
        // Use the first similar question as a match
        mapping.push({
          eventQuestionId: eventId,
          questionId: similarQuestions[0]._id,
          questionText: similarQuestions[0].text,
          matchType: 'pattern'
        });
        console.log(`Found pattern match for question ID: ${eventId} -> ${similarQuestions[0]._id.toString()}`);
      }
    }
    
    // For any remaining event question IDs, create a placeholder entry
    for (const eventId of eventQuestionIds) {
      // Skip if we already found a match
      if (mapping.some(m => m.eventQuestionId === eventId)) {
        continue;
      }
      
      mapping.push({
        eventQuestionId: eventId,
        questionId: null,
        questionText: `Question not found (ID: ${eventId})`,
        matchType: 'none'
      });
    }
    
    console.log(`Created ${mapping.length} mappings`);
    
    // Insert the mappings into the collection
    if (mapping.length > 0) {
      await db.collection('question_mapping').insertMany(mapping);
      console.log('Inserted mappings into question_mapping collection');
      
      // Create an index on eventQuestionId for faster lookups
      await db.collection('question_mapping').createIndex({ eventQuestionId: 1 });
      console.log('Created index on eventQuestionId');
    }
    
    // Print some statistics
    const matchTypes = mapping.reduce((acc, m) => {
      acc[m.matchType] = (acc[m.matchType] || 0) + 1;
      return acc;
    }, {});
    
    console.log('Match type statistics:');
    for (const [type, count] of Object.entries(matchTypes)) {
      console.log(`  ${type}: ${count} (${((count / mapping.length) * 100).toFixed(2)}%)`);
    }
    
    // Close the connection
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
    
    return mapping;
  } catch (error) {
    console.error('Error:', error);
  }
}

createQuestionMapping();
