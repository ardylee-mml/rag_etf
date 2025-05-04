require('dotenv').config();
const fs = require('fs');
const path = require('path');

// Function to test loading JSON files
function testJsonLoading() {
  try {
    console.log('Testing JSON file loading...');
    
    // Test loading questions_analysis.json
    try {
      const questionsAnalysisPath = path.join(__dirname, 'analysis', 'questions_analysis.json');
      console.log(`Checking if ${questionsAnalysisPath} exists...`);
      
      if (fs.existsSync(questionsAnalysisPath)) {
        console.log(`File exists: ${questionsAnalysisPath}`);
        const fileContent = fs.readFileSync(questionsAnalysisPath, 'utf8');
        console.log(`File size: ${fileContent.length} bytes`);
        
        try {
          const questionsAnalysis = JSON.parse(fileContent);
          console.log(`Successfully parsed questions_analysis.json`);
          console.log(`Contains ${questionsAnalysis.samples ? questionsAnalysis.samples.length : 0} samples`);
          console.log(`Contains ${questionsAnalysis.correctAnswers ? Object.keys(questionsAnalysis.correctAnswers).length : 0} correct answers`);
        } catch (parseError) {
          console.error(`Error parsing questions_analysis.json:`, parseError);
        }
      } else {
        console.log(`File does not exist: ${questionsAnalysisPath}`);
      }
    } catch (error) {
      console.error(`Error checking questions_analysis.json:`, error);
    }
    
    // Test loading question_correct_answers.json
    try {
      const correctAnswersPath = path.join(__dirname, 'analysis', 'question_correct_answers.json');
      console.log(`\nChecking if ${correctAnswersPath} exists...`);
      
      if (fs.existsSync(correctAnswersPath)) {
        console.log(`File exists: ${correctAnswersPath}`);
        const fileContent = fs.readFileSync(correctAnswersPath, 'utf8');
        console.log(`File size: ${fileContent.length} bytes`);
        
        try {
          const correctAnswers = JSON.parse(fileContent);
          console.log(`Successfully parsed question_correct_answers.json`);
          console.log(`Contains ${Object.keys(correctAnswers).length} correct answers`);
        } catch (parseError) {
          console.error(`Error parsing question_correct_answers.json:`, parseError);
        }
      } else {
        console.log(`File does not exist: ${correctAnswersPath}`);
      }
    } catch (error) {
      console.error(`Error checking question_correct_answers.json:`, error);
    }
    
    // Test loading ETF-specific files
    try {
      const etfCorrectAnswersPath = path.join(__dirname, 'analysis', 'etf_question_correct_answers.json');
      console.log(`\nChecking if ${etfCorrectAnswersPath} exists...`);
      
      if (fs.existsSync(etfCorrectAnswersPath)) {
        console.log(`File exists: ${etfCorrectAnswersPath}`);
        const fileContent = fs.readFileSync(etfCorrectAnswersPath, 'utf8');
        console.log(`File size: ${fileContent.length} bytes`);
        
        try {
          const etfCorrectAnswers = JSON.parse(fileContent);
          console.log(`Successfully parsed etf_question_correct_answers.json`);
          console.log(`Contains ${Object.keys(etfCorrectAnswers).length} ETF correct answers`);
        } catch (parseError) {
          console.error(`Error parsing etf_question_correct_answers.json:`, parseError);
        }
      } else {
        console.log(`File does not exist: ${etfCorrectAnswersPath}`);
      }
    } catch (error) {
      console.error(`Error checking etf_question_correct_answers.json:`, error);
    }
    
    // Test loading etf_questions.json
    try {
      const etfQuestionsPath = path.join(__dirname, 'analysis', 'etf_questions.json');
      console.log(`\nChecking if ${etfQuestionsPath} exists...`);
      
      if (fs.existsSync(etfQuestionsPath)) {
        console.log(`File exists: ${etfQuestionsPath}`);
        const fileContent = fs.readFileSync(etfQuestionsPath, 'utf8');
        console.log(`File size: ${fileContent.length} bytes`);
        
        try {
          const etfQuestions = JSON.parse(fileContent);
          console.log(`Successfully parsed etf_questions.json`);
          console.log(`Contains ${etfQuestions.length} ETF questions`);
        } catch (parseError) {
          console.error(`Error parsing etf_questions.json:`, parseError);
        }
      } else {
        console.log(`File does not exist: ${etfQuestionsPath}`);
      }
    } catch (error) {
      console.error(`Error checking etf_questions.json:`, error);
    }
    
    console.log('\nJSON loading test complete!');
  } catch (error) {
    console.error('Error in testJsonLoading:', error);
  }
}

// Run the test
testJsonLoading();
