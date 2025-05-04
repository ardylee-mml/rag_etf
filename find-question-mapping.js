require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');

async function findQuestionMapping() {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb+srv://mmluser-ro:1wzBCKHp2hBMCi69@clustermetamindinglab.qa8tyi1.mongodb.net/mmldb?retryWrites=true&w=majority';
    console.log('Connecting to MongoDB...');
    
    await mongoose.connect(mongoURI);
    console.log('MongoDB connected successfully');
    
    // Get the database
    const db = mongoose.connection.db;
    
    // Get the collections
    const questionsCollection = db.collection('questions');
    const eventsCollection = db.collection('events');
    
    // Get all questions
    const questions = await questionsCollection.find({}).toArray();
    console.log(`Found ${questions.length} questions`);
    
    // Get all question events
    const questionEvents = await eventsCollection.find({ type: 'question' }).limit(1000).toArray();
    console.log(`Found ${questionEvents.length} question events (limited to 1000)`);
    
    // Extract all question IDs from events
    const eventQuestionIds = new Set();
    questionEvents.forEach(event => {
      if (event.context && event.context.questionId) {
        eventQuestionIds.add(event.context.questionId);
      }
    });
    console.log(`Found ${eventQuestionIds.size} unique question IDs in events`);
    
    // Extract all question IDs from questions collection
    const questionIds = new Set();
    questions.forEach(question => {
      questionIds.add(question._id.toString());
    });
    console.log(`Found ${questionIds.size} unique question IDs in questions collection`);
    
    // Check for direct matches
    const directMatches = new Set([...eventQuestionIds].filter(id => questionIds.has(id)));
    console.log(`Found ${directMatches.size} direct matches between event questionIds and question _ids`);
    
    if (directMatches.size > 0) {
      console.log('Sample direct matches:');
      let count = 0;
      for (const id of directMatches) {
        if (count++ >= 5) break;
        console.log(`- ${id}`);
      }
    }
    
    // If we have direct matches, let's verify them
    if (directMatches.size > 0) {
      console.log('\nVerifying direct matches:');
      const matchId = Array.from(directMatches)[0];
      
      const question = await questionsCollection.findOne({ _id: matchId });
      const events = await eventsCollection.find({ 'context.questionId': matchId }).limit(5).toArray();
      
      console.log(`Question with ID ${matchId}:`);
      console.log(JSON.stringify(question, null, 2));
      
      console.log(`Events with questionId ${matchId}:`);
      console.log(JSON.stringify(events[0], null, 2));
    }
    
    // If we don't have direct matches, let's try to find any pattern
    if (directMatches.size === 0) {
      console.log('\nNo direct matches found. Trying to find patterns...');
      
      // Check if there's any field in questions that might match with event questionIds
      const potentialMatches = [];
      
      for (const question of questions) {
        // Check all string fields
        for (const [key, value] of Object.entries(question)) {
          if (typeof value === 'string' && eventQuestionIds.has(value)) {
            potentialMatches.push({ questionId: question._id.toString(), matchField: key, matchValue: value });
          }
        }
        
        // Check nested fields
        for (const [key, value] of Object.entries(question)) {
          if (typeof value === 'object' && value !== null) {
            for (const [nestedKey, nestedValue] of Object.entries(value)) {
              if (typeof nestedValue === 'string' && eventQuestionIds.has(nestedValue)) {
                potentialMatches.push({ 
                  questionId: question._id.toString(), 
                  matchField: `${key}.${nestedKey}`, 
                  matchValue: nestedValue 
                });
              }
            }
          }
        }
      }
      
      console.log(`Found ${potentialMatches.length} potential matches through other fields`);
      if (potentialMatches.length > 0) {
        console.log('Sample potential matches:');
        potentialMatches.slice(0, 5).forEach(match => {
          console.log(`- Question ID: ${match.questionId}, Field: ${match.matchField}, Value: ${match.matchValue}`);
        });
      }
    }
    
    // Let's try a different approach - check if the question text appears in the events
    console.log('\nChecking if question text appears in events...');
    let textMatches = 0;
    
    for (const question of questions.slice(0, 10)) { // Limit to first 10 questions for performance
      const questionText = question.text;
      if (!questionText) continue;
      
      // Look for this text in events
      const matchingEvents = await eventsCollection.find({
        $or: [
          { 'context.text': questionText },
          { 'context.questionText': questionText },
          { 'text': questionText }
        ]
      }).limit(1).toArray();
      
      if (matchingEvents.length > 0) {
        textMatches++;
        console.log(`Found match for question text: "${questionText.substring(0, 50)}..."`);
        console.log(JSON.stringify(matchingEvents[0], null, 2));
      }
    }
    
    console.log(`Found ${textMatches} matches by question text`);
    
    // Let's try one more approach - check if the choice IDs in questions match with choice IDs in events
    console.log('\nChecking if choice IDs match...');
    let choiceMatches = 0;
    
    for (const question of questions.slice(0, 10)) { // Limit to first 10 questions
      if (!question.choices || !Array.isArray(question.choices)) continue;
      
      for (const choice of question.choices) {
        if (!choice._id) continue;
        
        const choiceId = choice._id.toString();
        
        // Look for this choice ID in events
        const matchingEvents = await eventsCollection.find({
          'context.choiceId': choiceId
        }).limit(1).toArray();
        
        if (matchingEvents.length > 0) {
          choiceMatches++;
          console.log(`Found match for choice ID: ${choiceId}`);
          console.log(`Question: ${question.text}`);
          console.log(`Choice: ${choice.text}`);
          console.log(JSON.stringify(matchingEvents[0], null, 2));
          
          // This is important - if we find a match, record the mapping
          console.log(`MAPPING: Event questionId ${matchingEvents[0].context.questionId} -> Question _id ${question._id}`);
        }
      }
    }
    
    console.log(`Found ${choiceMatches} matches by choice ID`);
    
    // If we found any mapping, let's test it with a sample aggregation
    if (choiceMatches > 0) {
      console.log('\nTesting aggregation with choice ID mapping...');
      
      // First, get all questions with their choices
      const questionsWithChoices = await questionsCollection.find({}).toArray();
      
      // Create a mapping from choice ID to question
      const choiceToQuestionMap = new Map();
      
      for (const question of questionsWithChoices) {
        if (!question.choices || !Array.isArray(question.choices)) continue;
        
        for (const choice of question.choices) {
          if (!choice._id) continue;
          
          const choiceId = choice._id.toString();
          choiceToQuestionMap.set(choiceId, {
            questionId: question._id.toString(),
            questionText: question.text
          });
        }
      }
      
      console.log(`Created mapping with ${choiceToQuestionMap.size} choice IDs`);
      
      // Now, get events with these choice IDs
      const choiceIds = Array.from(choiceToQuestionMap.keys()).slice(0, 100); // Limit to first 100 for performance
      
      const eventsWithChoices = await eventsCollection.find({
        'context.choiceId': { $in: choiceIds }
      }).limit(100).toArray();
      
      console.log(`Found ${eventsWithChoices.length} events with mapped choice IDs`);
      
      // Create a mapping from event questionId to actual question
      const eventQuestionIdMap = new Map();
      
      for (const event of eventsWithChoices) {
        if (!event.context || !event.context.choiceId || !event.context.questionId) continue;
        
        const choiceId = event.context.choiceId;
        const questionInfo = choiceToQuestionMap.get(choiceId);
        
        if (questionInfo) {
          eventQuestionIdMap.set(event.context.questionId, questionInfo);
        }
      }
      
      console.log(`Created mapping with ${eventQuestionIdMap.size} event questionIds`);
      
      // Save the mapping to a file
      const mapping = Array.from(eventQuestionIdMap.entries()).map(([eventQuestionId, questionInfo]) => ({
        eventQuestionId,
        questionId: questionInfo.questionId,
        questionText: questionInfo.questionText
      }));
      
      fs.writeFileSync('question-mapping.json', JSON.stringify(mapping, null, 2));
      console.log('Saved mapping to question-mapping.json');
      
      // Print a sample of the mapping
      console.log('\nSample mapping:');
      mapping.slice(0, 5).forEach(item => {
        console.log(`Event questionId: ${item.eventQuestionId} -> Question _id: ${item.questionId} (${item.questionText.substring(0, 50)}...)`);
      });
    }
    
  } catch (error) {
    console.error('Error finding question mapping:', error);
  } finally {
    // Close the connection
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
  }
}

// Run the function
findQuestionMapping();
