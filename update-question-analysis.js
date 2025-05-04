require('dotenv').config();
const fs = require('fs');
const path = require('path');

// Function to update the original analysis files
async function updateQuestionAnalysis() {
  try {
    console.log('Starting to update question analysis files...');
    
    // Define file paths
    const questionsAnalysisPath = path.join(__dirname, 'analysis', 'questions_analysis.json');
    const correctAnswersPath = path.join(__dirname, 'analysis', 'question_correct_answers.json');
    const enhancedAnalysisPath = path.join(__dirname, 'analysis', 'enhanced_questions_analysis.json');
    
    // Check if the enhanced analysis file exists
    if (!fs.existsSync(enhancedAnalysisPath)) {
      console.error('Enhanced questions analysis file not found. Please run enhance-questions-analysis.js first.');
      return;
    }
    
    // Load the enhanced analysis file
    const enhancedAnalysisContent = fs.readFileSync(enhancedAnalysisPath, 'utf8');
    const enhancedAnalysis = JSON.parse(enhancedAnalysisContent);
    
    // Check if the original questions analysis file exists
    if (fs.existsSync(questionsAnalysisPath)) {
      console.log('Updating questions_analysis.json...');
      
      // Load the original file
      const originalAnalysisContent = fs.readFileSync(questionsAnalysisPath, 'utf8');
      const originalAnalysis = JSON.parse(originalAnalysisContent);
      
      // Update the original analysis with correct answer information
      if (enhancedAnalysis.correctAnswers) {
        originalAnalysis.correctAnswers = enhancedAnalysis.correctAnswers;
      }
      
      // Update the samples to include correct answer information
      if (enhancedAnalysis.samples && Array.isArray(enhancedAnalysis.samples)) {
        originalAnalysis.samples = enhancedAnalysis.samples;
      }
      
      // Add the new queries if they don't exist
      if (enhancedAnalysis.queries && Array.isArray(enhancedAnalysis.queries)) {
        if (!originalAnalysis.queries) {
          originalAnalysis.queries = [];
        }
        
        // Add any new queries that don't already exist
        enhancedAnalysis.queries.forEach(newQuery => {
          const exists = originalAnalysis.queries.some(
            existingQuery => existingQuery.description === newQuery.description
          );
          
          if (!exists) {
            originalAnalysis.queries.push(newQuery);
          }
        });
      }
      
      // Save the updated file
      fs.writeFileSync(questionsAnalysisPath, JSON.stringify(originalAnalysis, null, 2));
      console.log('Successfully updated questions_analysis.json');
    } else {
      console.log('Original questions_analysis.json not found, creating it...');
      fs.writeFileSync(questionsAnalysisPath, JSON.stringify(enhancedAnalysis, null, 2));
      console.log('Created new questions_analysis.json');
    }
    
    // Check if the correct answers file exists
    if (fs.existsSync(correctAnswersPath)) {
      console.log('Correct answers file already exists, no need to update');
    } else if (enhancedAnalysis.correctAnswers) {
      console.log('Creating question_correct_answers.json...');
      fs.writeFileSync(correctAnswersPath, JSON.stringify(enhancedAnalysis.correctAnswers, null, 2));
      console.log('Successfully created question_correct_answers.json');
    }
    
    console.log('Question analysis files update complete!');
    
  } catch (error) {
    console.error('Error updating question analysis:', error);
  }
}

// Run the function
updateQuestionAnalysis();
