/**
 * Question Generator Module
 *
 * Generates natural language questions based on schema information,
 * relationships, and query patterns.
 */

/**
 * Generates natural language questions based on schema, relationships, and query patterns
 * @param {Object} schemaInfo Schema information from the schema analyzer
 * @param {Array} relationships Discovered relationships between collections
 * @param {Array} queryPatterns Generated query patterns
 * @returns {Array} Generated questions with their corresponding query patterns
 */
function generateQuestions(schemaInfo, relationships, queryPatterns) {
  const questions = [];

  console.log('Generating questions...');

  // Generate questions for each query pattern
  for (const pattern of queryPatterns) {
    console.log(`Generating questions for pattern: ${pattern.id}`);

    switch (pattern.type) {
      case 'find':
        generateFindQuestions(pattern, schemaInfo, questions);
        break;

      case 'aggregate':
        generateAggregateQuestions(pattern, schemaInfo, questions);
        break;

      case 'lookup':
        generateLookupQuestions(pattern, schemaInfo, relationships, questions);
        break;

      case 'complex':
        generateComplexQuestions(pattern, schemaInfo, relationships, questions);
        break;
    }
  }

  // Generate additional questions based on relationships
  for (const relationship of relationships) {
    // Skip multi-level relationships - we'll handle them separately
    if (relationship.type !== 'multi-level') {
      generateRelationshipQuestions(relationship, schemaInfo, questions);
    }
  }

  // Generate questions for multi-level relationships
  console.log('Generating questions for multi-level relationships...');
  const multiLevelRelationships = relationships.filter(rel => rel.type === 'multi-level');
  for (const relationship of multiLevelRelationships) {
    generateQuestionsForMultiLevelRelationship(relationship, questions);
  }

  // Generate game-specific questions for Escape To Freedom
  generateGameSpecificQuestions(schemaInfo, relationships, questions);

  console.log(`Generated ${questions.length} questions`);
  return questions;
}

/**
 * Generates questions for find query patterns
 * @param {Object} pattern Query pattern
 * @param {Object} schemaInfo Schema information
 * @param {Array} questions Array to add generated questions to
 */
function generateFindQuestions(pattern, schemaInfo, questions) {
  const collection = pattern.collection;
  const singularName = getSingularName(collection);

  // Basic find all questions
  if (pattern.id.startsWith('find_all_')) {
    questions.push({
      id: `question_${pattern.id}_1`,
      text: `What are all the ${collection} in the system?`,
      intent: 'list_all',
      collections: [collection],
      queryPattern: pattern,
      complexity: 'basic',
      category: 'retrieval'
    });

    questions.push({
      id: `question_${pattern.id}_2`,
      text: `Show me all ${collection}.`,
      intent: 'list_all',
      collections: [collection],
      queryPattern: pattern,
      complexity: 'basic',
      category: 'retrieval'
    });

    questions.push({
      id: `question_${pattern.id}_3`,
      text: `List all ${collection}.`,
      intent: 'list_all',
      collections: [collection],
      queryPattern: pattern,
      complexity: 'basic',
      category: 'retrieval'
    });
  }

  // Find by ID questions
  if (pattern.id.startsWith('find_') && pattern.id.endsWith('_by_id')) {
    if (pattern.mongoQuery && pattern.mongoQuery.parameters) {
      const idParam = pattern.mongoQuery.parameters.find(p => p.name === 'id_value');
      if (idParam) {
        questions.push({
          id: `question_${pattern.id}_1`,
          text: `Find the ${singularName} with ID "example_id".`,
          intent: 'find_by_id',
          collections: [collection],
          queryPattern: pattern,
          parameters: {
            id_value: 'example_id'
          },
          complexity: 'basic',
          category: 'retrieval',
          parameterized: true
        });

        questions.push({
          id: `question_${pattern.id}_2`,
          text: `Get details for ${singularName} with ID "example_id".`,
          intent: 'find_by_id',
          collections: [collection],
          queryPattern: pattern,
          parameters: {
            id_value: 'example_id'
          },
          complexity: 'basic',
          category: 'retrieval',
          parameterized: true
        });
      }
    }
  }

  // Find by field questions
  if (pattern.id.startsWith('find_') && pattern.id.includes('_by_') && !pattern.id.endsWith('_by_id')) {
    if (pattern.fieldInfo && pattern.mongoQuery && pattern.mongoQuery.parameters) {
      const fieldParam = pattern.mongoQuery.parameters.find(p => p.name === 'field_value');
      if (fieldParam) {
        const fieldName = pattern.fieldInfo.name;
        const exampleValue = fieldParam.example || 'example_value';

        questions.push({
          id: `question_${pattern.id}_1`,
          text: `Find ${collection} where ${fieldName} is "${exampleValue}".`,
          intent: 'find_by_field',
          collections: [collection],
          queryPattern: pattern,
          parameters: {
            field_value: exampleValue
          },
          complexity: 'basic',
          category: 'retrieval',
          parameterized: true
        });

        questions.push({
          id: `question_${pattern.id}_2`,
          text: `Show me ${collection} with ${fieldName} equal to "${exampleValue}".`,
          intent: 'find_by_field',
          collections: [collection],
          queryPattern: pattern,
          parameters: {
            field_value: exampleValue
          },
          complexity: 'basic',
          category: 'retrieval',
          parameterized: true
        });

        // Generate more natural questions for specific fields
        if (fieldName.endsWith('Id') || fieldName.endsWith('_id')) {
          const relatedEntity = fieldName.replace('Id', '').replace('_id', '');
          questions.push({
            id: `question_${pattern.id}_3`,
            text: `Which ${collection} are related to ${relatedEntity} "${exampleValue}"?`,
            intent: 'find_by_field',
            collections: [collection],
            queryPattern: pattern,
            parameters: {
              field_value: exampleValue
            },
            complexity: 'basic',
            category: 'retrieval',
            parameterized: true
          });
        }
      }
    }
  }
}

/**
 * Generates questions for aggregate query patterns
 * @param {Object} pattern Query pattern
 * @param {Object} schemaInfo Schema information
 * @param {Array} questions Array to add generated questions to
 */
function generateAggregateQuestions(pattern, schemaInfo, questions) {
  const collection = pattern.collection;

  // Count questions
  if (pattern.id.startsWith('count_')) {
    questions.push({
      id: `question_${pattern.id}_1`,
      text: `How many ${collection} are there?`,
      intent: 'count',
      collections: [collection],
      queryPattern: pattern,
      complexity: 'basic',
      category: 'analytics'
    });

    questions.push({
      id: `question_${pattern.id}_2`,
      text: `What is the total number of ${collection}?`,
      intent: 'count',
      collections: [collection],
      queryPattern: pattern,
      complexity: 'basic',
      category: 'analytics'
    });
  }

  // Average questions
  if (pattern.id.startsWith('avg_') && pattern.fieldInfo) {
    const fieldName = pattern.fieldInfo.name;

    questions.push({
      id: `question_${pattern.id}_1`,
      text: `What is the average ${fieldName} in ${collection}?`,
      intent: 'calculate_average',
      collections: [collection],
      queryPattern: pattern,
      complexity: 'intermediate',
      category: 'analytics'
    });

    questions.push({
      id: `question_${pattern.id}_2`,
      text: `Calculate the average ${fieldName} across all ${collection}.`,
      intent: 'calculate_average',
      collections: [collection],
      queryPattern: pattern,
      complexity: 'intermediate',
      category: 'analytics'
    });
  }

  // Sum questions
  if (pattern.id.startsWith('sum_') && pattern.fieldInfo) {
    const fieldName = pattern.fieldInfo.name;

    questions.push({
      id: `question_${pattern.id}_1`,
      text: `What is the total sum of ${fieldName} in ${collection}?`,
      intent: 'calculate_sum',
      collections: [collection],
      queryPattern: pattern,
      complexity: 'intermediate',
      category: 'analytics'
    });

    questions.push({
      id: `question_${pattern.id}_2`,
      text: `Calculate the total ${fieldName} across all ${collection}.`,
      intent: 'calculate_sum',
      collections: [collection],
      queryPattern: pattern,
      complexity: 'intermediate',
      category: 'analytics'
    });
  }

  // Min/Max questions
  if (pattern.id.startsWith('min_max_') && pattern.fieldInfo) {
    const fieldName = pattern.fieldInfo.name;

    questions.push({
      id: `question_${pattern.id}_1`,
      text: `What are the minimum and maximum ${fieldName} values in ${collection}?`,
      intent: 'find_min_max',
      collections: [collection],
      queryPattern: pattern,
      complexity: 'intermediate',
      category: 'analytics'
    });

    questions.push({
      id: `question_${pattern.id}_2`,
      text: `What is the range of ${fieldName} in ${collection}?`,
      intent: 'find_min_max',
      collections: [collection],
      queryPattern: pattern,
      complexity: 'intermediate',
      category: 'analytics'
    });
  }

  // Date grouping questions
  if (pattern.id.startsWith('group_by_date_') && pattern.fieldInfo) {
    const fieldName = pattern.fieldInfo.name;

    questions.push({
      id: `question_${pattern.id}_1`,
      text: `How many ${collection} are there per day based on ${fieldName}?`,
      intent: 'group_by_date',
      collections: [collection],
      queryPattern: pattern,
      complexity: 'intermediate',
      category: 'analytics'
    });

    questions.push({
      id: `question_${pattern.id}_2`,
      text: `Show the distribution of ${collection} over time by ${fieldName}.`,
      intent: 'group_by_date',
      collections: [collection],
      queryPattern: pattern,
      complexity: 'intermediate',
      category: 'analytics'
    });
  }
}

/**
 * Generates questions for lookup query patterns
 * @param {Object} pattern Query pattern
 * @param {Object} schemaInfo Schema information
 * @param {Array} relationships Discovered relationships
 * @param {Array} questions Array to add generated questions to
 */
function generateLookupQuestions(pattern, schemaInfo, relationships, questions) {
  if (!pattern.collections || pattern.collections.length < 2) return;

  const sourceCollection = pattern.collections[0];
  const targetCollection = pattern.collections[1];
  const singularSource = getSingularName(sourceCollection);
  const singularTarget = getSingularName(targetCollection);

  // Basic lookup questions
  if (pattern.id.startsWith('lookup_')) {
    questions.push({
      id: `question_${pattern.id}_1`,
      text: `Show ${sourceCollection} with their related ${targetCollection}.`,
      intent: 'find_related',
      collections: [sourceCollection, targetCollection],
      queryPattern: pattern,
      complexity: 'intermediate',
      category: 'relationship'
    });

    questions.push({
      id: `question_${pattern.id}_2`,
      text: `Find ${sourceCollection} and include their ${targetCollection} information.`,
      intent: 'find_related',
      collections: [sourceCollection, targetCollection],
      queryPattern: pattern,
      complexity: 'intermediate',
      category: 'relationship'
    });

    questions.push({
      id: `question_${pattern.id}_3`,
      text: `Which ${targetCollection} are associated with each ${singularSource}?`,
      intent: 'find_related',
      collections: [sourceCollection, targetCollection],
      queryPattern: pattern,
      complexity: 'intermediate',
      category: 'relationship'
    });
  }

  // Count related documents questions
  if (pattern.id.startsWith('count_related_')) {
    questions.push({
      id: `question_${pattern.id}_1`,
      text: `How many ${targetCollection} are associated with each ${singularSource}?`,
      intent: 'count_related',
      collections: [sourceCollection, targetCollection],
      queryPattern: pattern,
      complexity: 'intermediate',
      category: 'relationship'
    });

    questions.push({
      id: `question_${pattern.id}_2`,
      text: `Count the number of ${targetCollection} for each ${singularSource}.`,
      intent: 'count_related',
      collections: [sourceCollection, targetCollection],
      queryPattern: pattern,
      complexity: 'intermediate',
      category: 'relationship'
    });

    questions.push({
      id: `question_${pattern.id}_3`,
      text: `Which ${singularSource} has the most ${targetCollection}?`,
      intent: 'count_related',
      collections: [sourceCollection, targetCollection],
      queryPattern: pattern,
      complexity: 'intermediate',
      category: 'relationship'
    });
  }
}

/**
 * Generates questions for complex query patterns
 * @param {Object} pattern Query pattern
 * @param {Object} schemaInfo Schema information
 * @param {Array} relationships Discovered relationships
 * @param {Array} questions Array to add generated questions to
 */
function generateComplexQuestions(pattern, schemaInfo, relationships, questions) {
  // Average attempts per question pattern
  if (pattern.id === 'avg_attempts_per_question') {
    questions.push({
      id: `question_${pattern.id}_1`,
      text: `What is the average number of attempts per question?`,
      intent: 'question_attempts',
      collections: pattern.collections,
      queryPattern: pattern,
      complexity: 'advanced',
      category: 'analytics'
    });

    questions.push({
      id: `question_${pattern.id}_2`,
      text: `How many times do players typically attempt each question?`,
      intent: 'question_attempts',
      collections: pattern.collections,
      queryPattern: pattern,
      complexity: 'advanced',
      category: 'analytics'
    });

    questions.push({
      id: `question_${pattern.id}_3`,
      text: `Which questions take the most attempts to answer?`,
      intent: 'hardest_questions',
      collections: pattern.collections,
      queryPattern: pattern,
      complexity: 'advanced',
      category: 'analytics'
    });

    questions.push({
      id: `question_${pattern.id}_4`,
      text: `What are the most difficult questions based on number of attempts?`,
      intent: 'hardest_questions',
      collections: pattern.collections,
      queryPattern: pattern,
      complexity: 'advanced',
      category: 'analytics'
    });
  }

  // Correct answer rate per question pattern
  if (pattern.id === 'correct_answer_rate_per_question') {
    questions.push({
      id: `question_${pattern.id}_1`,
      text: `What is the correct answer rate for each question?`,
      intent: 'question_correctness',
      collections: pattern.collections,
      queryPattern: pattern,
      complexity: 'advanced',
      category: 'analytics'
    });

    questions.push({
      id: `question_${pattern.id}_2`,
      text: `Which questions have the lowest correct answer rate?`,
      intent: 'hardest_questions',
      collections: pattern.collections,
      queryPattern: pattern,
      complexity: 'advanced',
      category: 'analytics'
    });

    questions.push({
      id: `question_${pattern.id}_3`,
      text: `What percentage of attempts for each question are correct?`,
      intent: 'question_correctness',
      collections: pattern.collections,
      queryPattern: pattern,
      complexity: 'advanced',
      category: 'analytics'
    });
  }

  // Player activity over time pattern
  if (pattern.id === 'player_activity_over_time') {
    questions.push({
      id: `question_${pattern.id}_1`,
      text: `How does player activity change over time?`,
      intent: 'player_activity',
      collections: pattern.collections,
      queryPattern: pattern,
      complexity: 'advanced',
      category: 'analytics'
    });

    questions.push({
      id: `question_${pattern.id}_2`,
      text: `Which players are most active and when?`,
      intent: 'player_activity',
      collections: pattern.collections,
      queryPattern: pattern,
      complexity: 'advanced',
      category: 'analytics'
    });

    questions.push({
      id: `question_${pattern.id}_3`,
      text: `Show me the activity patterns of the top 10 most active players.`,
      intent: 'player_activity',
      collections: pattern.collections,
      queryPattern: pattern,
      complexity: 'advanced',
      category: 'analytics'
    });
  }

  // Player play frequency pattern
  if (pattern.id === 'player_play_frequency') {
    questions.push({
      id: `question_${pattern.id}_1`,
      text: `What is the percentage of players who played more than 3 times?`,
      intent: 'player_frequency',
      collections: pattern.collections,
      queryPattern: pattern,
      complexity: 'advanced',
      category: 'analytics',
      parameters: {
        threshold: 3
      }
    });

    questions.push({
      id: `question_${pattern.id}_2`,
      text: `What percentage of players have played more than 5 times?`,
      intent: 'player_frequency',
      collections: pattern.collections,
      queryPattern: pattern,
      complexity: 'advanced',
      category: 'analytics',
      parameters: {
        threshold: 5
      }
    });

    questions.push({
      id: `question_${pattern.id}_3`,
      text: `How many players played more than 10 times as a percentage?`,
      intent: 'player_frequency',
      collections: pattern.collections,
      queryPattern: pattern,
      complexity: 'advanced',
      category: 'analytics',
      parameters: {
        threshold: 10
      }
    });

    questions.push({
      id: `question_${pattern.id}_4`,
      text: `What is the percentage of players who played more than once?`,
      intent: 'player_frequency',
      collections: pattern.collections,
      queryPattern: pattern,
      complexity: 'advanced',
      category: 'analytics',
      parameters: {
        threshold: 1
      }
    });
  }

  // Player play count distribution pattern
  if (pattern.id === 'player_play_count_distribution') {
    questions.push({
      id: `question_${pattern.id}_1`,
      text: `What is the distribution of player play counts?`,
      intent: 'player_distribution',
      collections: pattern.collections,
      queryPattern: pattern,
      complexity: 'advanced',
      category: 'analytics'
    });

    questions.push({
      id: `question_${pattern.id}_2`,
      text: `How many times do players typically play the game?`,
      intent: 'player_distribution',
      collections: pattern.collections,
      queryPattern: pattern,
      complexity: 'advanced',
      category: 'analytics'
    });

    questions.push({
      id: `question_${pattern.id}_3`,
      text: `What percentage of players play the game only once?`,
      intent: 'player_distribution',
      collections: pattern.collections,
      queryPattern: pattern,
      complexity: 'advanced',
      category: 'analytics'
    });

    questions.push({
      id: `question_${pattern.id}_4`,
      text: `Show me the breakdown of player engagement by number of plays.`,
      intent: 'player_distribution',
      collections: pattern.collections,
      queryPattern: pattern,
      complexity: 'advanced',
      category: 'analytics'
    });
  }
}

/**
 * Generates questions based on relationships
 * @param {Object} relationship Relationship information
 * @param {Object} schemaInfo Schema information
 * @param {Array} questions Array to add generated questions to
 */
function generateRelationshipQuestions(relationship, schemaInfo, questions) {
  const sourceCollection = relationship.source.collection;
  const targetCollection = relationship.target.collection;
  const singularSource = getSingularName(sourceCollection);
  const singularTarget = getSingularName(targetCollection);

  // Skip if we already have questions for this relationship
  const existingQuestions = questions.filter(q =>
    q.collections &&
    q.collections.includes(sourceCollection) &&
    q.collections.includes(targetCollection)
  );

  if (existingQuestions.length >= 3) return;

  // Generate relationship-specific questions
  const relationshipId = `relationship_${sourceCollection}_${targetCollection}`;

  questions.push({
    id: `question_${relationshipId}_1`,
    text: `What is the relationship between ${sourceCollection} and ${targetCollection}?`,
    intent: 'describe_relationship',
    collections: [sourceCollection, targetCollection],
    relationship: relationship,
    complexity: 'basic',
    category: 'relationship'
  });

  if (relationship.description) {
    questions.push({
      id: `question_${relationshipId}_2`,
      text: `How do ${sourceCollection} relate to ${targetCollection}?`,
      intent: 'describe_relationship',
      collections: [sourceCollection, targetCollection],
      relationship: relationship,
      complexity: 'basic',
      category: 'relationship',
      answer: relationship.description
    });
  }
}

/**
 * Generates game-specific questions for Escape To Freedom
 * @param {Object} schemaInfo Schema information
 * @param {Array} relationships Discovered relationships
 * @param {Array} questions Array to add generated questions to
 */
function generateGameSpecificQuestions(schemaInfo, relationships, questions) {
  // Player progress questions
  if (schemaInfo.players && schemaInfo.events && schemaInfo.zones) {
    questions.push({
      id: 'question_game_player_progress_1',
      text: `How far have players progressed through the game zones?`,
      intent: 'player_progress',
      collections: ['players', 'events', 'zones'],
      complexity: 'advanced',
      category: 'game_analytics'
    });

    questions.push({
      id: 'question_game_player_progress_2',
      text: `Which zone do most players get stuck in?`,
      intent: 'player_progress',
      collections: ['players', 'events', 'zones'],
      complexity: 'advanced',
      category: 'game_analytics'
    });
  }

  // Learning outcomes questions
  if (schemaInfo.players && schemaInfo.events && schemaInfo.questions) {
    questions.push({
      id: 'question_game_learning_outcomes_1',
      text: `What are the learning outcomes based on question performance?`,
      intent: 'learning_outcomes',
      collections: ['players', 'events', 'questions'],
      complexity: 'advanced',
      category: 'educational_analytics'
    });

    questions.push({
      id: 'question_game_learning_outcomes_2',
      text: `How does player performance on questions improve over time?`,
      intent: 'learning_outcomes',
      collections: ['players', 'events', 'questions'],
      complexity: 'advanced',
      category: 'educational_analytics'
    });
  }

  // Item usage questions
  if (schemaInfo.events && schemaInfo.items) {
    questions.push({
      id: 'question_game_item_usage_1',
      text: `Which items are used most frequently by players?`,
      intent: 'item_usage',
      collections: ['events', 'items'],
      complexity: 'intermediate',
      category: 'game_analytics'
    });

    questions.push({
      id: 'question_game_item_usage_2',
      text: `Is there a correlation between item usage and player progress?`,
      intent: 'item_usage',
      collections: ['events', 'items', 'players'],
      complexity: 'advanced',
      category: 'game_analytics'
    });
  }

  // Leaderboard questions
  if (schemaInfo.leaderboards && schemaInfo.players) {
    questions.push({
      id: 'question_game_leaderboard_1',
      text: `Who are the top 10 players on the leaderboard?`,
      intent: 'leaderboard',
      collections: ['leaderboards', 'players'],
      complexity: 'basic',
      category: 'game_analytics'
    });

    questions.push({
      id: 'question_game_leaderboard_2',
      text: `How do leaderboard scores correlate with question performance?`,
      intent: 'leaderboard',
      collections: ['leaderboards', 'players', 'events', 'questions'],
      complexity: 'advanced',
      category: 'game_analytics'
    });
  }
}

/**
 * Generates questions for multi-level relationships
 * @param {Object} relationship Multi-level relationship
 * @param {Array} questions Array to add generated questions to
 */
function generateQuestionsForMultiLevelRelationship(relationship, questions) {
  if (!relationship.path || relationship.path.length < 2) return;

  const firstRel = relationship.path[0];
  const secondRel = relationship.path[1];
  const sourceCollection = firstRel.source.collection;
  const middleCollection = firstRel.target.collection;
  const targetCollection = secondRel.target.collection;

  const singularSource = getSingularName(sourceCollection);
  const singularMiddle = getSingularName(middleCollection);
  const singularTarget = getSingularName(targetCollection);

  // Find multi-level relationship patterns
  const lookupPattern = {
    id: `multi_level_lookup_${sourceCollection}_${middleCollection}_${targetCollection}`,
    type: 'multi-lookup',
    collections: [sourceCollection, middleCollection, targetCollection],
    description: `Find ${sourceCollection} with related ${middleCollection} and ${targetCollection}`
  };

  const countPattern = {
    id: `multi_level_count_${sourceCollection}_${middleCollection}_${targetCollection}`,
    type: 'multi-lookup',
    collections: [sourceCollection, middleCollection, targetCollection],
    description: `Count ${targetCollection} related to ${sourceCollection} through ${middleCollection}`
  };

  const aggregatePattern = {
    id: `multi_level_aggregate_${sourceCollection}_${middleCollection}_${targetCollection}`,
    type: 'multi-lookup',
    collections: [sourceCollection, middleCollection, targetCollection],
    description: `Aggregate ${targetCollection} metrics related to ${sourceCollection} through ${middleCollection}`
  };

  // Generate questions for multi-level lookup
  questions.push({
    id: `question_multi_level_lookup_${sourceCollection}_${middleCollection}_${targetCollection}_1`,
    text: `Show ${sourceCollection} with their related ${middleCollection} and ${targetCollection}.`,
    intent: 'multi_level_lookup',
    collections: [sourceCollection, middleCollection, targetCollection],
    queryPattern: lookupPattern,
    complexity: 'advanced',
    category: 'relationship'
  });

  questions.push({
    id: `question_multi_level_lookup_${sourceCollection}_${middleCollection}_${targetCollection}_2`,
    text: `Find ${sourceCollection} and include both their ${middleCollection} and ${targetCollection} information.`,
    intent: 'multi_level_lookup',
    collections: [sourceCollection, middleCollection, targetCollection],
    queryPattern: lookupPattern,
    complexity: 'advanced',
    category: 'relationship'
  });

  questions.push({
    id: `question_multi_level_lookup_${sourceCollection}_${middleCollection}_${targetCollection}_3`,
    text: `Which ${targetCollection} are connected to ${sourceCollection} through ${middleCollection}?`,
    intent: 'multi_level_lookup',
    collections: [sourceCollection, middleCollection, targetCollection],
    queryPattern: lookupPattern,
    complexity: 'advanced',
    category: 'relationship'
  });

  // Generate questions for multi-level count
  questions.push({
    id: `question_multi_level_count_${sourceCollection}_${middleCollection}_${targetCollection}_1`,
    text: `How many ${targetCollection} are associated with each ${singularSource} through ${middleCollection}?`,
    intent: 'multi_level_count',
    collections: [sourceCollection, middleCollection, targetCollection],
    queryPattern: countPattern,
    complexity: 'advanced',
    category: 'relationship'
  });

  questions.push({
    id: `question_multi_level_count_${sourceCollection}_${middleCollection}_${targetCollection}_2`,
    text: `Count the number of ${targetCollection} for each ${singularSource} through their ${middleCollection}.`,
    intent: 'multi_level_count',
    collections: [sourceCollection, middleCollection, targetCollection],
    queryPattern: countPattern,
    complexity: 'advanced',
    category: 'relationship'
  });

  questions.push({
    id: `question_multi_level_count_${sourceCollection}_${middleCollection}_${targetCollection}_3`,
    text: `Which ${singularSource} has the most ${targetCollection} through ${middleCollection}?`,
    intent: 'multi_level_count',
    collections: [sourceCollection, middleCollection, targetCollection],
    queryPattern: countPattern,
    complexity: 'advanced',
    category: 'relationship'
  });

  // Generate questions for multi-level aggregation
  questions.push({
    id: `question_multi_level_aggregate_${sourceCollection}_${middleCollection}_${targetCollection}_1`,
    text: `Analyze the relationship between ${sourceCollection}, ${middleCollection}, and ${targetCollection}.`,
    intent: 'multi_level_aggregate',
    collections: [sourceCollection, middleCollection, targetCollection],
    queryPattern: aggregatePattern,
    complexity: 'advanced',
    category: 'analytics'
  });

  questions.push({
    id: `question_multi_level_aggregate_${sourceCollection}_${middleCollection}_${targetCollection}_2`,
    text: `Summarize how ${sourceCollection} connect to ${targetCollection} through ${middleCollection}.`,
    intent: 'multi_level_aggregate',
    collections: [sourceCollection, middleCollection, targetCollection],
    queryPattern: aggregatePattern,
    complexity: 'advanced',
    category: 'analytics'
  });

  // Generate specific questions based on collection names
  if (sourceCollection === 'players' && middleCollection === 'events' && targetCollection === 'questions') {
    questions.push({
      id: `question_multi_level_specific_${sourceCollection}_${middleCollection}_${targetCollection}_1`,
      text: `Which questions have players answered through their events?`,
      intent: 'multi_level_lookup',
      collections: [sourceCollection, middleCollection, targetCollection],
      queryPattern: lookupPattern,
      complexity: 'advanced',
      category: 'relationship'
    });

    questions.push({
      id: `question_multi_level_specific_${sourceCollection}_${middleCollection}_${targetCollection}_2`,
      text: `How many questions has each player answered?`,
      intent: 'multi_level_count',
      collections: [sourceCollection, middleCollection, targetCollection],
      queryPattern: countPattern,
      complexity: 'advanced',
      category: 'relationship'
    });
  }

  if (sourceCollection === 'players' && middleCollection === 'events' && targetCollection === 'items') {
    questions.push({
      id: `question_multi_level_specific_${sourceCollection}_${middleCollection}_${targetCollection}_1`,
      text: `Which items have players interacted with through their events?`,
      intent: 'multi_level_lookup',
      collections: [sourceCollection, middleCollection, targetCollection],
      queryPattern: lookupPattern,
      complexity: 'advanced',
      category: 'relationship'
    });

    questions.push({
      id: `question_multi_level_specific_${sourceCollection}_${middleCollection}_${targetCollection}_2`,
      text: `How many items has each player interacted with?`,
      intent: 'multi_level_count',
      collections: [sourceCollection, middleCollection, targetCollection],
      queryPattern: countPattern,
      complexity: 'advanced',
      category: 'relationship'
    });
  }
}

/**
 * Gets the singular form of a collection name
 * @param {String} collectionName Collection name
 * @returns {String} Singular form of the collection name
 */
function getSingularName(collectionName) {
  if (collectionName.endsWith('s')) {
    return collectionName.slice(0, -1);
  }
  return collectionName;
}

module.exports = { generateQuestions };
