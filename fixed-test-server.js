require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(cors());

// Load pre-computed analysis files
let questionsAnalysis = null;
let questionCorrectAnswers = null;
let etfQuestionCorrectAnswers = null;
let etfQuestions = null;

// ETF User ID constant
const ETF_USER_ID = 'e9ccd5c4-0aea-4b38-b4e7-6a03c6f05169';

// Add process error handlers
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Kill any existing process on port 3000
try {
  console.log(`Checking for existing processes on port ${PORT}...`);
  const pid = execSync(`lsof -t -i:${PORT}`).toString().trim();
  
  if (pid) {
    console.log(`Found process ${pid} using port ${PORT}. Killing it...`);
    execSync(`kill -9 ${pid}`);
    console.log(`Process ${pid} killed.`);
    
    // Wait a moment before continuing
    console.log('Waiting for port to be released...');
    execSync('sleep 2');
  }
} catch (error) {
  // No process found or other error, which is fine
  console.log(`No existing process found on port ${PORT}`);
}

// Function to load analysis files
function loadAnalysisFiles() {
  try {
    console.log('Loading analysis files...');
    
    // Load questions_analysis.json
    const questionsAnalysisPath = path.join(__dirname, 'analysis', 'questions_analysis.json');
    if (fs.existsSync(questionsAnalysisPath)) {
      const fileContent = fs.readFileSync(questionsAnalysisPath, 'utf8');
      questionsAnalysis = JSON.parse(fileContent);
      console.log(`Loaded questions_analysis.json with ${questionsAnalysis.samples.length} samples`);
      
      // Extract correct answers if available
      if (questionsAnalysis.correctAnswers) {
        questionCorrectAnswers = questionsAnalysis.correctAnswers;
        console.log(`Loaded correct answers for ${Object.keys(questionCorrectAnswers).length} questions`);
      }
    }
    
    // Load ETF-specific files
    const etfCorrectAnswersPath = path.join(__dirname, 'analysis', 'etf_question_correct_answers.json');
    if (fs.existsSync(etfCorrectAnswersPath)) {
      const fileContent = fs.readFileSync(etfCorrectAnswersPath, 'utf8');
      etfQuestionCorrectAnswers = JSON.parse(fileContent);
      console.log(`Loaded ETF-specific correct answers for ${Object.keys(etfQuestionCorrectAnswers).length} questions`);
    }
    
    const etfQuestionsPath = path.join(__dirname, 'analysis', 'etf_questions.json');
    if (fs.existsSync(etfQuestionsPath)) {
      const fileContent = fs.readFileSync(etfQuestionsPath, 'utf8');
      etfQuestions = JSON.parse(fileContent);
      console.log(`Loaded ${etfQuestions.length} ETF questions from simplified file`);
    }
    
    console.log('Analysis files loaded successfully!');
  } catch (error) {
    console.error('Error loading analysis files:', error);
  }
}

// Import the Deepseek service
const deepseekService = require('./src/services/deepseekService');

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date(),
    server: {
      port: PORT,
      uptime: process.uptime()
    },
    database: {
      connected: mongoose.connection.readyState === 1,
      name: mongoose.connection.name
    },
    analysis: {
      questionsAnalysisLoaded: questionsAnalysis !== null,
      correctAnswersLoaded: questionCorrectAnswers !== null,
      etfQuestionsLoaded: etfQuestions !== null,
      etfCorrectAnswersLoaded: etfQuestionCorrectAnswers !== null
    }
  });
});

// Auth middleware
const authMiddleware = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'Authentication token is required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token has expired' });
    }
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// Login route
app.post('/api/auth/login', (req, res) => {
  try {
    const { username, password } = req.body;

    // Simple authentication for testing
    if (username === 'test' && password === 'test') {
      const token = jwt.sign(
        { userId: 'test-user-id', username: 'test' },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
      );

      res.json({ token });
    } else {
      res.status(401).json({ message: 'Invalid credentials' });
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Simple query route
app.post('/api/query', authMiddleware, async (req, res) => {
  try {
    const { query, collection = 'events', schemaInfo } = req.body;

    if (!query) {
      return res.status(400).json({ message: 'Query is required' });
    }

    console.log('Processing query:', query);
    console.log('Collection:', collection);
    console.log('Schema Info:', schemaInfo);

    // For specific query patterns, use our hardcoded pipelines for reliable results
    const lowerQuery = query.toLowerCase();
    let pipeline = null;
    let explanation = '';
    let results = [];

    // Handle counting questions query
    if ((lowerQuery.includes('count') || lowerQuery.includes('how many')) &&
        lowerQuery.includes('question')) {

      console.log('Using specialized pipeline for counting questions query');

      // First, get all questions to build a mapping
      const db = mongoose.connection.db;
      const questions = await db.collection('questions').find({}).toArray();
      console.log(`Found ${questions.length} questions in the database`);

      // Create a mapping from question ID to question text and correct choice ID
      const questionMap = {};
      const correctChoiceMap = {};

      // Use the pre-loaded correct answers if available
      if (questionCorrectAnswers) {
        console.log(`Using pre-loaded correct answers for ${Object.keys(questionCorrectAnswers).length} questions`);

        Object.entries(questionCorrectAnswers).forEach(([questionId, data]) => {
          questionMap[questionId] = data.questionText;
          if (data.correctChoiceId) {
            correctChoiceMap[questionId] = data.correctChoiceId;
          }
        });
      } else {
        // Fall back to computing from the questions collection
        console.log('No pre-loaded correct answers available, computing from questions collection');

        questions.forEach(q => {
          if (q._id && q.text) {
            const questionId = q._id.toString();
            questionMap[questionId] = q.text;

            // Find the correct choice (the one with notes field)
            if (q.choices && Array.isArray(q.choices)) {
              const correctChoice = q.choices.find(choice => choice.notes);
              if (correctChoice && correctChoice._id) {
                correctChoiceMap[questionId] = correctChoice._id.toString();
              }
            }
          }
        });
      }

      console.log(`Created mapping for ${Object.keys(questionMap).length} questions`);
      console.log(`Found correct choices for ${Object.keys(correctChoiceMap).length} questions`);

      // Check if we're looking for wrong answers on first attempt
      if (lowerQuery.includes('wrong') && lowerQuery.includes('first')) {
        console.log('Query is about wrong answers on first attempt');

        // Use the pre-loaded ETF data if available
        let localEtfQuestionCorrectAnswers = {};
        let etfQuestionIds = [];

        if (etfQuestionCorrectAnswers) {
          // Use the pre-loaded ETF correct answers
          console.log(`Using pre-loaded ETF correct answers for ${Object.keys(etfQuestionCorrectAnswers).length} questions`);
          localEtfQuestionCorrectAnswers = etfQuestionCorrectAnswers;
          etfQuestionIds = Object.keys(etfQuestionCorrectAnswers);
        } else if (etfQuestions) {
          // Use the pre-loaded ETF questions
          console.log(`Using pre-loaded ETF questions (${etfQuestions.length})`);
          etfQuestionIds = etfQuestions.map(q => q.id);

          // Create a mapping of correct answers from the simplified format
          etfQuestions.forEach(q => {
            if (q.id && q.correctChoiceId) {
              localEtfQuestionCorrectAnswers[q.id] = {
                questionId: q.id,
                questionText: q.text,
                correctChoiceId: q.correctChoiceId,
                correctChoiceText: q.correctChoiceText,
                correctChoiceNotes: q.notes,
                userId: ETF_USER_ID
              };
            }
          });
        } else if (questionCorrectAnswers) {
          // Filter from the pre-loaded correct answers
          console.log('Filtering ETF questions from pre-loaded correct answers');

          Object.entries(questionCorrectAnswers).forEach(([questionId, questionData]) => {
            if (questionData.userId === ETF_USER_ID) {
              localEtfQuestionCorrectAnswers[questionId] = questionData;
              etfQuestionIds.push(questionId);
            }
          });

          console.log(`Filtered ${etfQuestionIds.length} ETF questions from pre-loaded correct answers`);
        } else {
          // Last resort: filter from all questions in the database
          console.log('No pre-loaded ETF data available, filtering from database questions');

          const etfQuestionsFromDb = questions.filter(q =>
            q.userId && q.userId.toString() === ETF_USER_ID
          );

          etfQuestionIds = etfQuestionsFromDb.map(q => q._id.toString());

          // Create a mapping of correct answers
          etfQuestionsFromDb.forEach(q => {
            if (q._id && q.text) {
              const questionId = q._id.toString();
              let correctChoice = null;

              if (q.choices && Array.isArray(q.choices)) {
                correctChoice = q.choices.find(choice => choice.notes);
              }

              localEtfQuestionCorrectAnswers[questionId] = {
                questionId: questionId,
                questionText: q.text,
                correctChoiceId: correctChoice ? correctChoice._id.toString() : null,
                correctChoiceText: correctChoice ? correctChoice.text : null,
                correctChoiceNotes: correctChoice ? correctChoice.notes : null,
                userId: ETF_USER_ID
              };
            }
          });

          console.log(`Filtered ${etfQuestionIds.length} ETF questions from database`);
        }

        console.log(`Found ${etfQuestionIds.length} questions from Escape To Freedom`);

        // Get all question events
        const eventsCollection = db.collection('events');
        const questionEvents = await eventsCollection.find({
          type: 'question',
          'context.questionId': { $in: etfQuestionIds }
        }).toArray();

        console.log(`Found ${questionEvents.length} question events for ETF questions`);

        // Group events by player and question to find first attempts
        const playerQuestionAttempts = {};

        questionEvents.forEach(event => {
          const playerId = event.playerId;
          const questionId = event.context.questionId;
          const choiceId = event.context.choiceId;
          const key = `${playerId}-${questionId}`;

          if (!playerQuestionAttempts[key]) {
            playerQuestionAttempts[key] = [];
          }

          playerQuestionAttempts[key].push({
            timestamp: event.time,
            choiceId: choiceId
          });
        });

        // Sort attempts by timestamp and count wrong first attempts
        const wrongFirstAttempts = {};

        Object.entries(playerQuestionAttempts).forEach(([key, attempts]) => {
          // Sort attempts by timestamp (ascending)
          attempts.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

          // Get the first attempt
          const firstAttempt = attempts[0];
          if (firstAttempt) {
            const questionId = key.split('-')[1];

            // Get the correct choice ID either from ETF mapping or from the correctChoiceMap
            let correctChoiceId = null;

            if (localEtfQuestionCorrectAnswers[questionId]) {
              correctChoiceId = localEtfQuestionCorrectAnswers[questionId].correctChoiceId;
            } else {
              correctChoiceId = correctChoiceMap[questionId];
            }

            // Check if the first attempt was wrong
            if (correctChoiceId && firstAttempt.choiceId !== correctChoiceId) {
              if (!wrongFirstAttempts[questionId]) {
                wrongFirstAttempts[questionId] = 0;
              }
              wrongFirstAttempts[questionId]++;
            }
          }
        });

        // Create the results
        const wrongAnswerResults = Object.entries(wrongFirstAttempts).map(([questionId, count]) => {
          // Get question text either from ETF mapping or from the questionMap
          let questionText = null;

          if (localEtfQuestionCorrectAnswers[questionId]) {
            questionText = localEtfQuestionCorrectAnswers[questionId].questionText;
          } else {
            questionText = questionMap[questionId];
          }

          return {
            questionId: questionId,
            questionText: questionText || null,
            wrongFirstAttempts: count
          };
        });

        // Sort by count in descending order
        wrongAnswerResults.sort((a, b) => b.wrongFirstAttempts - a.wrongFirstAttempts);

        console.log(`Found ${wrongAnswerResults.length} questions with wrong first attempts`);

        // Set the explanation
        explanation = 'This pipeline counts how many players answered each question wrong on their first attempt by:' +
          '\n1. Loading pre-computed ETF-specific correct answer data from JSON files' +
          '\n2. Only including questions from Escape To Freedom (filtered by userId)' +
          '\n3. Getting all question events for these questions' +
          '\n4. Grouping events by player and question to identify first attempts' +
          '\n5. Checking if the first attempt used the correct choice (marked with notes field)' +
          '\n6. Counting wrong first attempts for each question' +
          '\n7. Sorting by count in descending order';

        // Set the results
        results = wrongAnswerResults;
      } else {
        // Standard question count query
        pipeline = [
          { $match: { type: 'question' } },
          { $group: {
            _id: '$context.questionId',
            count: { $sum: 1 }
          }},
          // Sort by count in descending order
          { $sort: { count: -1 } }
        ];

        // Get the collection and execute the aggregation
        const eventsCollection = db.collection(collection);
        const aggregationResults = await eventsCollection.aggregate(pipeline).toArray();
        console.log(`Found ${aggregationResults.length} question groups`);

        // Manually add the question text using our mapping
        const enhancedResults = aggregationResults.map(result => {
          const questionId = result._id;
          return {
            questionId: questionId,
            questionText: questionMap[questionId] || null,
            count: result.count
          };
        });

        // Log how many questions have text
        const withText = enhancedResults.filter(r => r.questionText).length;
        console.log(`${withText} out of ${enhancedResults.length} questions have text (${Math.round(withText/enhancedResults.length*100)}%)`);

        // Set the explanation
        explanation = 'This pipeline counts how many times each question has been answered by:' +
          '\n1. Filtering for question events' +
          '\n2. Grouping by questionId and counting occurrences' +
          '\n3. Sorting by count in descending order' +
          '\n4. Manually adding question text using a pre-built mapping' +
          '\n5. Showing all results (no limit applied)';

        // Set the results
        results = enhancedResults;
      }

      // Log the results to verify
      console.log(`Sending ${results.length} results to client`);
    }
    // If no specialized pipeline, use Deepseek LLM
    else {
      // Process the query through Deepseek LLM
      try {
        // Enhance schemaInfo with our pre-loaded analysis data
        let enhancedSchemaInfo = schemaInfo || {};

        // Add information about the questions collection and correct answers
        if (questionsAnalysis) {
          enhancedSchemaInfo.questionsAnalysis = {
            fieldAnalysis: questionsAnalysis.fieldAnalysis,
            relationshipFields: questionsAnalysis.relationshipFields,
            sampleCount: questionsAnalysis.samples.length
          };

          // Add information about correct answers if available
          if (questionCorrectAnswers) {
            enhancedSchemaInfo.correctAnswersAvailable = true;
            enhancedSchemaInfo.correctAnswersCount = Object.keys(questionCorrectAnswers).length;
          }

          // Add information about ETF questions if available
          if (etfQuestionCorrectAnswers) {
            enhancedSchemaInfo.etfQuestionsAvailable = true;
            enhancedSchemaInfo.etfQuestionsCount = Object.keys(etfQuestionCorrectAnswers).length;
          }
        }

        console.log('Enhanced schema info with pre-loaded analysis data');

        const deepseekResponse = await deepseekService.processQuery(query, collection, enhancedSchemaInfo);
        console.log('Deepseek Response:', deepseekResponse);

        if (deepseekResponse && deepseekResponse.content) {
          try {
            // Try to parse the content as a MongoDB query
            pipeline = JSON.parse(deepseekResponse.content);
            explanation = `MongoDB aggregation pipeline generated by Deepseek LLM based on natural language query: "${query}"`;

            // If the query is about questions, enhance the explanation
            if (lowerQuery.includes('question')) {
              explanation += '\n\nThis query was enhanced with pre-loaded analysis data about questions and their correct answers.';
            }
          } catch (parseError) {
            console.error('Error parsing Deepseek response:', parseError);
            // Will use fallback pipeline below
          }
        }
      } catch (deepseekError) {
        console.error('Error calling Deepseek service:', deepseekError);
        // Will use fallback pipeline below
      }
    }

    // If we still don't have a valid pipeline, use a fallback
    if (!pipeline) {
      console.log('Using fallback pipeline');
      pipeline = [{ $match: {} }, { $limit: 10 }];
      explanation = 'Fallback query that returns the first 10 documents';
    }

    // Get the specified collection
    const db = mongoose.connection.db;
    const mongoCollection = db.collection(collection);

    // Execute the aggregation pipeline if we haven't already set results
    if (results.length === 0) {
      results = await mongoCollection.aggregate(pipeline).toArray();
    }

    // Debug: Log the first few results to check structure
    if (results.length > 0) {
      console.log('Sample result:', JSON.stringify(results[0], null, 2));
    }

    // Check if we have any results
    let message = null;
    if (results.length === 0) {
      // Check if we're looking for question events
      if (pipeline.some(stage =>
          stage.$match && stage.$match.type === 'question')) {
        message = "No matching question events found. The database contains question events, but none match your specific criteria.";
      } else if (lowerQuery.includes('question')) {
        message = "No matching question data found. Try modifying your query to match the actual data structure.";
      } else {
        message = "No results found for this query. The query may be correct, but there is no matching data.";
      }
    }

    // Log what we're sending to the client
    console.log(`Sending response to client with ${results ? results.length : 0} results`);

    res.json({
      query,
      timestamp: new Date(),
      results,
      processedQuery: `db.${collection}.aggregate(${JSON.stringify(pipeline)})`,
      pipeline: pipeline,
      explanation: explanation,
      message: message
    });
  } catch (error) {
    console.error('Query execution error:', error);
    res.status(500).json({ message: 'Query execution failed', error: error.message });
  }
});

// Relationship query route
app.post('/api/query/relationship', authMiddleware, async (req, res) => {
  try {
    const { query, primaryCollection, relatedCollection, schemaInfo } = req.body;

    if (!query || !primaryCollection || !relatedCollection) {
      return res.status(400).json({
        message: 'Query, primaryCollection, and relatedCollection are required'
      });
    }

    console.log('Processing relationship query:', query);
    console.log('Primary Collection:', primaryCollection);
    console.log('Related Collection:', relatedCollection);

    // Process the query through Deepseek LLM
    let pipeline = null;
    let explanation = '';

    try {
      const deepseekResponse = await deepseekService.processRelationshipQuery(
        query, primaryCollection, relatedCollection, schemaInfo
      );
      console.log('Deepseek Response:', deepseekResponse);

      if (deepseekResponse && deepseekResponse.content) {
        try {
          // Try to parse the content as a MongoDB query
          pipeline = JSON.parse(deepseekResponse.content);
          explanation = `MongoDB aggregation pipeline generated by Deepseek LLM based on natural language query: "${query}"`;
        } catch (parseError) {
          console.error('Error parsing Deepseek response:', parseError);
          // Will use fallback pipeline below
        }
      }
    } catch (deepseekError) {
      console.error('Error calling Deepseek service:', deepseekError);
      // Will use fallback pipeline below
    }

    // If we still don't have a valid pipeline, use a fallback
    if (!pipeline) {
      console.log('Using fallback pipeline');
      pipeline = [
        { $match: {} },
        { $limit: 10 },
        {
          $lookup: {
            from: relatedCollection,
            localField: '_id',
            foreignField: primaryCollection + 'Id',
            as: 'related'
          }
        }
      ];
      explanation = 'Fallback query that returns the first 10 documents with a simple lookup';
    }

    // Get the specified collection
    const db = mongoose.connection.db;
    const mongoCollection = db.collection(primaryCollection);

    // Execute the aggregation pipeline
    const results = await mongoCollection.aggregate(pipeline).toArray();

    // Log what we're sending to the client
    console.log(`Sending response to client with ${results.length} results`);

    res.json({
      query,
      timestamp: new Date(),
      results,
      processedQuery: `db.${primaryCollection}.aggregate(${JSON.stringify(pipeline)})`,
      pipeline: pipeline,
      explanation: explanation
    });
  } catch (error) {
    console.error('Relationship query execution error:', error);
    res.status(500).json({ message: 'Relationship query execution failed' });
  }
});

// Database connection
console.log('Connecting to MongoDB...');
console.log('MongoDB URI:', process.env.MONGODB_URI);

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('Connected to MongoDB');

    // Get a list of collections
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();

    console.log('Collections:');
    collections.forEach(collection => {
      console.log(`- ${collection.name}`);
    });

    // Load analysis files
    loadAnalysisFiles();

    // Start the server
    console.log(`Starting server on port ${PORT}...`);
    const server = app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
      console.log('API endpoints:');
      console.log('- POST /api/auth/login');
      console.log('- POST /api/query');
      console.log('- POST /api/query/relationship');
      console.log('- GET /api/health');
    });

    server.on('error', (error) => {
      console.error('Server error:', error);
      process.exit(1);
    });
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });
