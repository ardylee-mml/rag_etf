require('dotenv').config();
const fs = require('fs');
const path = require('path');

// Escape to Freedom userId
const ETF_USER_ID = 'e9ccd5c4-0aea-4b38-b4e7-6a03c6f05169';

async function filterMainFiles() {
  try {
    console.log('Starting to filter main analysis files...');
    
    // Process questions_analysis.json
    const questionsAnalysisPath = path.join(__dirname, 'analysis', 'questions_analysis.json');
    if (fs.existsSync(questionsAnalysisPath)) {
      console.log('Processing questions_analysis.json...');
      const fileContent = fs.readFileSync(questionsAnalysisPath, 'utf8');
      const analysis = JSON.parse(fileContent);
      
      // Filter samples
      if (analysis.samples && Array.isArray(analysis.samples)) {
        const originalSamplesCount = analysis.samples.length;
        analysis.samples = analysis.samples.filter(sample => 
          sample.userId && sample.userId.toString() === ETF_USER_ID
        );
        console.log(`Filtered samples: ${originalSamplesCount} -> ${analysis.samples.length}`);
      }
      
      // Filter correctAnswers
      if (analysis.correctAnswers) {
        const originalCorrectAnswersCount = Object.keys(analysis.correctAnswers).length;
        const filteredCorrectAnswers = {};
        
        Object.entries(analysis.correctAnswers).forEach(([questionId, questionData]) => {
          if (questionData.userId === ETF_USER_ID) {
            filteredCorrectAnswers[questionId] = questionData;
          }
        });
        
        analysis.correctAnswers = filteredCorrectAnswers;
        console.log(`Filtered correctAnswers: ${originalCorrectAnswersCount} -> ${Object.keys(filteredCorrectAnswers).length}`);
      }
      
      // Save the filtered file
      fs.writeFileSync(questionsAnalysisPath, JSON.stringify(analysis, null, 2));
      console.log('Successfully updated questions_analysis.json');
    } else {
      console.log('questions_analysis.json not found');
    }
    
    // Process question_correct_answers.json
    const correctAnswersPath = path.join(__dirname, 'analysis', 'question_correct_answers.json');
    if (fs.existsSync(correctAnswersPath)) {
      console.log('Processing question_correct_answers.json...');
      const fileContent = fs.readFileSync(correctAnswersPath, 'utf8');
      const allAnswers = JSON.parse(fileContent);
      
      // Filter for ETF questions only
      const filteredAnswers = {};
      let filteredCount = 0;
      
      Object.entries(allAnswers).forEach(([questionId, questionData]) => {
        if (questionData.userId === ETF_USER_ID) {
          filteredAnswers[questionId] = questionData;
        } else {
          filteredCount++;
        }
      });
      
      console.log(`Filtered out ${filteredCount} non-ETF questions`);
      console.log(`Kept ${Object.keys(filteredAnswers).length} ETF questions`);
      
      // Save the filtered file
      fs.writeFileSync(correctAnswersPath, JSON.stringify(filteredAnswers, null, 2));
      console.log('Successfully updated question_correct_answers.json');
    } else {
      console.log('question_correct_answers.json not found');
    }
    
    console.log('Filtering complete!');
    
  } catch (error) {
    console.error('Error filtering main files:', error);
  }
}

// Run the function
filterMainFiles();
