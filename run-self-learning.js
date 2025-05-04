require('dotenv').config();
const { runSelfLearning } = require('./src/self-learning/self-learning');

async function main() {
  try {
    console.log('Starting self-learning process with detailed logging...');
    
    const result = await runSelfLearning({
      skipLargeCollections: false,
      maxTimeMS: 30000,
      validateQueries: true,
      sampleSize: 5,
      maxQueryRetries: 2,
      closeConnection: true
    });
    
    console.log('Self-learning process completed successfully!');
    console.log('Summary:', JSON.stringify(result.summary, null, 2));
    console.log(`Discovered ${result.relationships.length} relationships`);
    console.log(`Generated ${result.queryPatterns.length} query patterns`);
    console.log(`Generated ${result.validatedQuestions.length} questions`);
    
    // Check for multi-level relationships
    const multiLevelRelationships = result.relationships.filter(rel => rel.type === 'multi-level');
    console.log(`Found ${multiLevelRelationships.length} multi-level relationships`);
    
    if (multiLevelRelationships.length > 0) {
      console.log('Multi-level relationships:');
      multiLevelRelationships.forEach(rel => {
        console.log(`- ${rel.path[0].source.collection} -> ${rel.path[0].target.collection} -> ${rel.path[1].target.collection}`);
      });
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error running self-learning process:', error);
    process.exit(1);
  }
}

main();
