require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// Connect to MongoDB
async function enhanceQuestionsAnalysis() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Get the database
    const db = mongoose.connection.db;
    
    // Get all questions
    const questions = await db.collection('questions').find({}).toArray();
    console.log(`Found ${questions.length} questions in the database`);
    
    // Read existing analysis file if it exists
    let existingAnalysis = {};
    const analysisFilePath = path.join(__dirname, 'analysis', 'questions_analysis.json');
    
    if (fs.existsSync(analysisFilePath)) {
      try {
        const fileContent = fs.readFileSync(analysisFilePath, 'utf8');
        existingAnalysis = JSON.parse(fileContent);
        console.log('Successfully read existing questions_analysis.json');
      } catch (error) {
        console.error('Error reading existing analysis file:', error);
      }
    }
    
    // Enhance the analysis with correct answer information
    const enhancedSamples = questions.slice(0, 10).map(question => {
      // Find the correct choice (the one with notes field)
      let correctChoice = null;
      let correctChoiceId = null;
      
      if (question.choices && Array.isArray(question.choices)) {
        correctChoice = question.choices.find(choice => choice.notes);
        if (correctChoice && correctChoice._id) {
          correctChoiceId = correctChoice._id.toString();
        }
      }
      
      return {
        ...question,
        _correctChoiceId: correctChoiceId,
        _correctChoiceText: correctChoice ? correctChoice.text : null,
        _correctChoiceNotes: correctChoice ? correctChoice.notes : null
      };
    });
    
    // Create a mapping of all questions with their correct answers
    const questionCorrectAnswers = {};
    
    questions.forEach(question => {
      if (question._id) {
        const questionId = question._id.toString();
        let correctChoice = null;
        
        if (question.choices && Array.isArray(question.choices)) {
          correctChoice = question.choices.find(choice => choice.notes);
        }
        
        questionCorrectAnswers[questionId] = {
          questionId: questionId,
          questionText: question.text,
          correctChoiceId: correctChoice ? correctChoice._id.toString() : null,
          correctChoiceText: correctChoice ? correctChoice.text : null,
          correctChoiceNotes: correctChoice ? correctChoice.notes : null,
          userId: question.userId ? question.userId.toString() : null
        };
      }
    });
    
    // Create enhanced analysis
    const enhancedAnalysis = {
      ...existingAnalysis,
      samples: enhancedSamples,
      correctAnswers: questionCorrectAnswers,
      queries: [
        ...(existingAnalysis.queries || []),
        {
          description: "Find questions with their correct answers",
          naturalLanguage: "Show me all questions with their correct answers",
          mongoQuery: "db.questions.aggregate([\n  { $match: {} },\n  { $project: {\n    questionId: \"$_id\",\n    questionText: \"$text\",\n    correctChoice: {\n      $filter: {\n        input: \"$choices\",\n        as: \"choice\",\n        cond: { $ifNull: [\"$$choice.notes\", false] }\n      }\n    },\n    userId: 1\n  }},\n  { $unwind: { path: \"$correctChoice\", preserveNullAndEmptyArrays: true } }\n])"
        },
        {
          description: "Count wrong first attempts per question",
          naturalLanguage: "How many players answered each question wrong on their first attempt?",
          mongoQuery: "// This requires custom logic in JavaScript to:\n// 1. Find the correct choice for each question\n// 2. Group events by player and question to identify first attempts\n// 3. Check if first attempts were wrong\n// 4. Count wrong first attempts by question"
        }
      ]
    };
    
    // Save the enhanced analysis
    const enhancedFilePath = path.join(__dirname, 'analysis', 'enhanced_questions_analysis.json');
    fs.writeFileSync(enhancedFilePath, JSON.stringify(enhancedAnalysis, null, 2));
    console.log(`Enhanced analysis saved to ${enhancedFilePath}`);
    
    // Save just the correct answers mapping for easier use
    const correctAnswersFilePath = path.join(__dirname, 'analysis', 'question_correct_answers.json');
    fs.writeFileSync(correctAnswersFilePath, JSON.stringify(questionCorrectAnswers, null, 2));
    console.log(`Correct answers mapping saved to ${correctAnswersFilePath}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Close the connection
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
  }
}

// Run the function
enhanceQuestionsAnalysis();
