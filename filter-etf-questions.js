require('dotenv').config();
const fs = require('fs');
const path = require('path');

// Escape to Freedom userId
const ETF_USER_ID = 'e9ccd5c4-0aea-4b38-b4e7-6a03c6f05169';

async function filterEtfQuestions() {
  try {
    console.log('Starting to filter Escape to Freedom questions...');

    // Process question_correct_answers.json
    const correctAnswersPath = path.join(__dirname, 'analysis', 'question_correct_answers.json');
    if (fs.existsSync(correctAnswersPath)) {
      console.log('Processing question_correct_answers.json...');
      const fileContent = fs.readFileSync(correctAnswersPath, 'utf8');
      const allQuestions = JSON.parse(fileContent);

      // Filter for ETF questions only
      const etfQuestions = {};
      let filteredCount = 0;

      Object.entries(allQuestions).forEach(([questionId, questionData]) => {
        if (questionData.userId === ETF_USER_ID) {
          etfQuestions[questionId] = questionData;
        } else {
          filteredCount++;
        }
      });

      console.log(`Filtered out ${filteredCount} non-ETF questions`);
      console.log(`Kept ${Object.keys(etfQuestions).length} ETF questions`);

      // Save the filtered file
      const etfCorrectAnswersPath = path.join(__dirname, 'analysis', 'etf_question_correct_answers.json');
      fs.writeFileSync(etfCorrectAnswersPath, JSON.stringify(etfQuestions, null, 2));
      console.log(`Saved filtered correct answers to ${etfCorrectAnswersPath}`);
    } else {
      console.log('question_correct_answers.json not found');
    }

    // Process enhanced_questions_analysis.json
    const enhancedAnalysisPath = path.join(__dirname, 'analysis', 'enhanced_questions_analysis.json');
    if (fs.existsSync(enhancedAnalysisPath)) {
      console.log('Processing enhanced_questions_analysis.json...');
      const fileContent = fs.readFileSync(enhancedAnalysisPath, 'utf8');
      const enhancedAnalysis = JSON.parse(fileContent);

      // Filter samples
      if (enhancedAnalysis.samples && Array.isArray(enhancedAnalysis.samples)) {
        const originalSamplesCount = enhancedAnalysis.samples.length;
        enhancedAnalysis.samples = enhancedAnalysis.samples.filter(sample =>
          sample.userId && sample.userId.toString() === ETF_USER_ID
        );
        console.log(`Filtered samples: ${originalSamplesCount} -> ${enhancedAnalysis.samples.length}`);
      }

      // Filter correctAnswers if it exists
      if (enhancedAnalysis.correctAnswers) {
        const originalCorrectAnswersCount = Object.keys(enhancedAnalysis.correctAnswers).length;
        const filteredCorrectAnswers = {};

        Object.entries(enhancedAnalysis.correctAnswers).forEach(([questionId, questionData]) => {
          if (questionData.userId === ETF_USER_ID) {
            filteredCorrectAnswers[questionId] = questionData;
          }
        });

        enhancedAnalysis.correctAnswers = filteredCorrectAnswers;
        console.log(`Filtered correctAnswers: ${originalCorrectAnswersCount} -> ${Object.keys(filteredCorrectAnswers).length}`);
      }

      // Save the filtered enhanced analysis
      const etfEnhancedAnalysisPath = path.join(__dirname, 'analysis', 'etf_enhanced_questions_analysis.json');
      fs.writeFileSync(etfEnhancedAnalysisPath, JSON.stringify(enhancedAnalysis, null, 2));
      console.log(`Saved filtered enhanced analysis to ${etfEnhancedAnalysisPath}`);
    } else {
      console.log('enhanced_questions_analysis.json not found');
    }

    // Also create a simplified ETF questions file with just the essential information
    const etfQuestionsPath = path.join(__dirname, 'analysis', 'etf_questions.json');
    const etfCorrectAnswersPath = path.join(__dirname, 'analysis', 'etf_question_correct_answers.json');

    if (fs.existsSync(etfCorrectAnswersPath)) {
      const fileContent = fs.readFileSync(etfCorrectAnswersPath, 'utf8');
      const etfQuestions = JSON.parse(fileContent);

      // Create a simplified array format
      const simplifiedQuestions = Object.values(etfQuestions).map(q => ({
        id: q.questionId,
        text: q.questionText,
        correctChoiceId: q.correctChoiceId,
        correctChoiceText: q.correctChoiceText,
        notes: q.correctChoiceNotes
      }));

      fs.writeFileSync(etfQuestionsPath, JSON.stringify(simplifiedQuestions, null, 2));
      console.log(`Saved simplified ETF questions to ${etfQuestionsPath}`);
    }

    console.log('Filtering complete!');

  } catch (error) {
    console.error('Error filtering ETF questions:', error);
  }
}

// Run the function
filterEtfQuestions();
