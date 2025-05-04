require('dotenv').config();
const mongoose = require('mongoose');

// Connect to MongoDB
async function exploreQuestionEvents() {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb+srv://mmluser-ro:1wzBCKHp2hBMCi69@clustermetamindinglab.qa8tyi1.mongodb.net/mmldb?retryWrites=true&w=majority';
    console.log('Connecting to MongoDB...');
    
    await mongoose.connect(mongoURI);
    console.log('MongoDB connected successfully');
    
    // Get the database
    const db = mongoose.connection.db;
    
    // Get the collections
    const eventsCollection = db.collection('events');
    const questionsCollection = db.collection('questions');
    
    // 1. Analyze question events
    console.log('\n=== QUESTION EVENTS ANALYSIS ===');
    const questionEvents = await eventsCollection.find({ type: 'question' }).limit(10).toArray();
    console.log(`Found ${questionEvents.length} question events`);
    
    if (questionEvents.length > 0) {
      // Analyze the structure
      console.log('\nQuestion event structure:');
      console.log(JSON.stringify(questionEvents[0], null, 2));
      
      // Check for common fields
      const fields = new Set();
      const contextFields = new Set();
      
      questionEvents.forEach(event => {
        Object.keys(event).forEach(key => fields.add(key));
        if (event.context) {
          Object.keys(event.context).forEach(key => contextFields.add(key));
        }
      });
      
      console.log('\nCommon fields in question events:');
      console.log(Array.from(fields));
      
      console.log('\nCommon context fields in question events:');
      console.log(Array.from(contextFields));
      
      // Check if there's a correct/incorrect field
      const hasCorrectField = questionEvents.some(event => 'correct' in event || (event.context && 'correct' in event.context));
      console.log(`\nEvents have 'correct' field: ${hasCorrectField}`);
      
      // Check if there's a time taken field
      const hasTimeTakenField = questionEvents.some(event => 'timeTaken' in event || (event.context && 'timeTaken' in event.context));
      console.log(`Events have 'timeTaken' field: ${hasTimeTakenField}`);
    }
    
    // 2. Analyze the questions collection
    console.log('\n=== QUESTIONS COLLECTION ANALYSIS ===');
    const questions = await questionsCollection.find({}).limit(10).toArray();
    console.log(`Found ${questions.length} questions`);
    
    if (questions.length > 0) {
      // Analyze the structure
      console.log('\nQuestion document structure:');
      console.log(JSON.stringify(questions[0], null, 2));
      
      // Check for common fields
      const fields = new Set();
      questions.forEach(question => {
        Object.keys(question).forEach(key => fields.add(key));
      });
      
      console.log('\nCommon fields in question documents:');
      console.log(Array.from(fields));
      
      // Check for choices
      const hasChoices = questions.some(question => 'choices' in question && Array.isArray(question.choices));
      console.log(`\nQuestions have 'choices' field: ${hasChoices}`);
      
      if (hasChoices) {
        const sampleWithChoices = questions.find(question => 'choices' in question && Array.isArray(question.choices));
        if (sampleWithChoices) {
          console.log('\nSample question with choices:');
          console.log(JSON.stringify(sampleWithChoices, null, 2));
        }
      }
    }
    
    // 3. Find a sample of question events for a specific questionId
    if (questionEvents.length > 0 && questionEvents[0].context && questionEvents[0].context.questionId) {
      const sampleQuestionId = questionEvents[0].context.questionId;
      console.log(`\n=== EVENTS FOR QUESTION ID: ${sampleQuestionId} ===`);
      
      const eventsForQuestion = await eventsCollection.find({
        type: 'question',
        'context.questionId': sampleQuestionId
      }).limit(10).toArray();
      
      console.log(`Found ${eventsForQuestion.length} events for this question`);
      
      if (eventsForQuestion.length > 0) {
        // Count unique players who answered this question
        const uniquePlayers = new Set(eventsForQuestion.map(event => event.playerId));
        console.log(`Unique players who answered this question: ${uniquePlayers.size}`);
        
        // Get the question details
        const questionDetails = await questionsCollection.findOne({ _id: sampleQuestionId });
        if (questionDetails) {
          console.log('\nQuestion details:');
          console.log(JSON.stringify(questionDetails, null, 2));
        } else {
          console.log('\nNo matching question found in questions collection');
        }
      }
    }
    
    // 4. Create a sample aggregation to count questions by questionId
    console.log('\n=== SAMPLE AGGREGATION: COUNT BY QUESTION ID ===');
    
    const aggregationResult = await eventsCollection.aggregate([
      { $match: { type: 'question' } },
      { $group: { 
        _id: '$context.questionId', 
        count: { $sum: 1 } 
      }},
      { $lookup: {
        from: 'questions',
        localField: '_id',
        foreignField: '_id',
        as: 'questionDetails'
      }},
      { $unwind: { path: '$questionDetails', preserveNullAndEmptyArrays: true } },
      { $project: {
        questionId: '$_id',
        questionText: '$questionDetails.text',
        count: 1,
        _id: 0
      }},
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]).toArray();
    
    console.log('Aggregation results:');
    console.log(JSON.stringify(aggregationResult, null, 2));
    
    // 5. Check for any additional fields that might indicate correctness
    console.log('\n=== CHECKING FOR CORRECTNESS INDICATORS ===');
    
    // Look for events with choiceId
    if (questionEvents.some(event => event.context && event.context.choiceId)) {
      console.log('Events have choiceId in context. This might indicate the selected answer.');
      
      // Check if we can determine correctness by joining with questions collection
      if (questions.length > 0 && questions.some(q => q.choices && q.choices.some(c => 'correct' in c))) {
        console.log('Questions collection has "correct" field in choices. We can determine correctness by joining.');
        
        // Sample question with correct choice
        const sampleWithCorrect = questions.find(q => q.choices && q.choices.some(c => 'correct' in c));
        if (sampleWithCorrect) {
          console.log('\nSample question with correct choice:');
          console.log(JSON.stringify(sampleWithCorrect, null, 2));
          
          // Find the correct choice
          const correctChoice = sampleWithCorrect.choices.find(c => c.correct === true);
          if (correctChoice) {
            console.log(`\nCorrect choice ID: ${correctChoice._id}`);
            
            // Look for events with this choice
            const eventsWithCorrectChoice = await eventsCollection.find({
              type: 'question',
              'context.questionId': sampleWithCorrect._id,
              'context.choiceId': correctChoice._id
            }).limit(5).toArray();
            
            console.log(`\nFound ${eventsWithCorrectChoice.length} events with the correct choice`);
            if (eventsWithCorrectChoice.length > 0) {
              console.log('Sample event with correct choice:');
              console.log(JSON.stringify(eventsWithCorrectChoice[0], null, 2));
            }
          }
        }
      }
    }
    
  } catch (error) {
    console.error('Error exploring question events:', error);
  } finally {
    // Close the connection
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
  }
}

// Run the function
exploreQuestionEvents();
