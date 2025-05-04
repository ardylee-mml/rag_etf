import { useState } from 'react';
import axios from 'axios';

function RelationshipExplorer({ token, collections }) {
  const [primaryCollection, setPrimaryCollection] = useState('players');
  const [relatedCollection, setRelatedCollection] = useState('events');
  const [relationshipQuery, setRelationshipQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [queryDebugInfo, setQueryDebugInfo] = useState(null);

  const relationships = [
    { from: 'players', to: 'events', description: 'Players generate events through their actions' },
    { from: 'players', to: 'leaderboards', description: 'Players have scores on leaderboards' },
    { from: 'events', to: 'items', description: 'Events record item interactions' },
    { from: 'events', to: 'zones', description: 'Events track player movement through zones' },
    { from: 'events', to: 'questions', description: 'Events record question responses' },
    { from: 'questions', to: 'campaigns', description: 'Questions are part of campaigns' }
  ];

  const getRelationshipDescription = () => {
    const relationship = relationships.find(
      r => r.from === primaryCollection && r.to === relatedCollection
    );

    if (relationship) {
      return relationship.description;
    }

    const reverseRelationship = relationships.find(
      r => r.from === relatedCollection && r.to === primaryCollection
    );

    if (reverseRelationship) {
      return `${reverseRelationship.to} are related to ${reverseRelationship.from} (${reverseRelationship.description})`;
    }

    return `Explore how ${primaryCollection} relate to ${relatedCollection}`;
  };

  const generateRelationshipQuery = () => {
    const queries = {
      'players-events': 'Find all events where playerId equals "p1"',
      'players-leaderboards': 'Show leaderboard entries where playerId equals "p1"',
      'events-items': 'Find events where context.itemId matches an item _id',
      'events-zones': 'Show events where context.zoneId equals a zone _id',
      'events-questions': 'What is the average time for players to answer questions correctly?',
      'questions-events': 'Find events where context.questionId matches a question _id',
      'questions-campaigns': 'Show questions in campaign 1'
    };

    const key = `${primaryCollection}-${relatedCollection}`;
    const reverseKey = `${relatedCollection}-${primaryCollection}`;

    return queries[key] || queries[reverseKey] || `Find relationships between ${primaryCollection} and ${relatedCollection}`;
  };

  const handleCollectionChange = (primary, related) => {
    setPrimaryCollection(primary);
    setRelatedCollection(related);
    setRelationshipQuery(generateRelationshipQuery());
  };

  // Natural language query processor
  const processNaturalLanguageQuery = (query, primary, related) => {
    console.log('Processing natural language query:', query);

    // Convert query to lowercase for easier matching
    const queryLower = query.toLowerCase();

    // Check for question-related queries
    if (queryLower.includes('average time') &&
        (queryLower.includes('question') || queryLower.includes('questions')) &&
        (queryLower.includes('answer') || queryLower.includes('answers'))) {
      // This is a query about average answer time
      if ((primary === 'events' && related === 'questions') ||
          (primary === 'questions' && related === 'events') ||
          (primary === 'players' && related === 'events')) {
        return {
          type: 'question_answer_time',
          correctOnly: queryLower.includes('correctly') || queryLower.includes('correct'),
          aggregation: 'average',
          entity: queryLower.includes('players') ? 'players' : 'player',
          metric: 'timeTaken',
          // Add field mapping information
          fields: {
            events: {
              playerIdField: 'playerId',
              questionIdField: 'context.questionId'
            },
            questions: {
              idField: '_id'
            },
            players: {
              idField: 'playerId'
            }
          }
        };
      }
    }

    // Default to standard relationship query with field mapping information
    return {
      type: 'standard',
      primary,
      related,
      // Add field mapping information based on collections
      fields: {
        players: { idField: 'playerId' },
        events: {
          playerIdField: 'playerId',
          itemIdField: 'context.itemId',
          zoneIdField: 'context.zoneId',
          questionIdField: 'context.questionId'
        },
        items: { idField: '_id' },
        zones: { idField: '_id' },
        questions: { idField: '_id' },
        leaderboards: { playerIdField: 'playerId' }
      }
    };
  };

  // Generate MongoDB query from processed query info
  const generateMongoDBQuery = (queryInfo) => {
    if (queryInfo.type === 'question_answer_time') {
      // For question answer time queries
      const matchStage = queryInfo.correctOnly
        ? { $match: { type: 'question', correct: true } }
        : { $match: { type: 'question' } };

      const groupStage = {
        $group: {
          _id: null,
          averageTime: { $avg: '$timeTaken' },
          count: { $sum: 1 }
        }
      };

      return {
        collection: 'events',
        pipeline: [
          matchStage,
          groupStage,
          { $project: { _id: 0, averageTime: 1, count: 1 } }
        ],
        explanation: `This MongoDB aggregation pipeline:
1. Filters for question events${queryInfo.correctOnly ? ' with correct answers' : ''}
2. Groups all matching events and calculates the average time taken
3. Returns the average time and count of events`,
        fieldMappings: queryInfo.fields
      };
    }

    // For standard relationship queries between collections
    let pipeline = [];

    // Add appropriate lookup stage based on the relationship
    if (queryInfo.primary === 'players' && queryInfo.related === 'events') {
      pipeline = [
        { $match: {} }, // Empty match to start with all documents
        { $lookup: {
            from: 'events',
            localField: 'playerId',
            foreignField: 'playerId',
            as: 'events'
          }
        },
        { $unwind: '$events' },
        { $project: {
            player_id: '$playerId',
            event_id: '$events._id',
            event_type: '$events.type',
            timestamp: '$events.timestamp'
          }
        }
      ];
    } else if (queryInfo.primary === 'events' && queryInfo.related === 'items') {
      pipeline = [
        { $match: { type: 'item' } },
        { $lookup: {
            from: 'items',
            localField: 'context.itemId',
            foreignField: '_id',
            as: 'item'
          }
        },
        { $unwind: '$item' },
        { $project: {
            event_id: '$_id',
            player_id: '$playerId',
            item_id: '$item._id',
            item_name: '$item.name',
            action: '$type'
          }
        }
      ];
    } else if (queryInfo.primary === 'events' && queryInfo.related === 'zones') {
      pipeline = [
        { $match: { type: 'zone' } },
        { $lookup: {
            from: 'zones',
            localField: 'context.zoneId',
            foreignField: '_id',
            as: 'zone'
          }
        },
        { $unwind: '$zone' },
        { $project: {
            event_id: '$_id',
            player_id: '$playerId',
            zone_id: '$zone._id',
            zone_name: '$zone.name',
            action: '$type'
          }
        }
      ];
    } else if ((queryInfo.primary === 'events' && queryInfo.related === 'questions') ||
               (queryInfo.primary === 'questions' && queryInfo.related === 'events')) {
      // Determine which is primary and which is related
      const primaryCollection = queryInfo.primary === 'events' ? 'events' : 'questions';
      const relatedCollection = queryInfo.primary === 'events' ? 'questions' : 'events';

      pipeline = [
        { $match: primaryCollection === 'events' ? { type: 'question' } : {} },
        { $lookup: {
            from: relatedCollection,
            localField: primaryCollection === 'events' ? 'context.questionId' : '_id',
            foreignField: primaryCollection === 'events' ? '_id' : 'context.questionId',
            as: 'related'
          }
        },
        { $unwind: '$related' },
        { $project: {
            event_id: primaryCollection === 'events' ? '$_id' : '$related._id',
            player_id: primaryCollection === 'events' ? '$playerId' : '$related.playerId',
            question_id: primaryCollection === 'events' ? '$context.questionId' : '$_id',
            correct: primaryCollection === 'events' ? '$correct' : '$related.correct',
            timeTaken: primaryCollection === 'events' ? '$timeTaken' : '$related.timeTaken'
          }
        }
      ];
    }

    return {
      collection: queryInfo.primary,
      pipeline: pipeline,
      explanation: `MongoDB aggregation pipeline to find relationships between ${queryInfo.primary} and ${queryInfo.related} using the correct field mappings`,
      fieldMappings: queryInfo.fields
    };
  };

  // No mock relationship data handler - we always use the real API

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!relationshipQuery.trim()) {
      setError('Please enter a query');
      return;
    }

    try {
      setLoading(true);
      setError('');

      // Process the natural language query and store debug info
      const queryInfo = processNaturalLanguageQuery(relationshipQuery, primaryCollection, relatedCollection);

      // Create debug info object
      const debugInfo = {
        originalQuery: relationshipQuery,
        primaryCollection,
        relatedCollection,
        processedQuery: queryInfo,
        mongoDBQuery: generateMongoDBQuery(queryInfo)
      };

      // Set debug info for display
      setQueryDebugInfo(debugInfo);

      // Always use real API with Deepseek LLM
      // Use the relationship endpoint we fixed
      const response = await axios.post('/api/query/relationship', {
        query: relationshipQuery,
        primaryCollection: primaryCollection,
        relatedCollection: relatedCollection,
        schemaInfo: {
          // Provide correct field mappings based on collection relationships
          players: { idField: 'playerId' },
          events: {
            playerIdField: 'playerId',
            itemIdField: 'context.itemId',
            zoneIdField: 'context.zoneId',
            questionIdField: 'context.questionId'
          },
          items: { idField: '_id' },
          zones: { idField: '_id' },
          questions: { idField: '_id' },
          leaderboards: { playerIdField: 'playerId' }
        }
      }, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      // Update debug info with the actual Deepseek processing information
      if (response.data.processedQuery) {
        setQueryDebugInfo({
          ...debugInfo,
          deepseekProcessed: true,
          processedQuery: response.data.processedQuery,
          mongoDBQuery: response.data.pipeline || debugInfo.mongoDBQuery,
          explanation: response.data.explanation,
          message: response.data.message,
          tokenUsage: response.data.tokenUsage
        });
      }

      const results = response.data.results || [];
      setResults(results);
    } catch (err) {
      setError('Query failed: ' + (err.response?.data?.message || err.message));
      setResults([]);
      setQueryDebugInfo(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">Relationship Explorer</h2>
      </div>

      <div className="relationship-container">
        {error && <div className="error">{error}</div>}

        <div className="relationship-header">
          <p className="relationship-intro">Explore relationships between different collections in the Escape To Freedom game database.</p>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="primary-collection">Primary Collection:</label>
              <select
                id="primary-collection"
                value={primaryCollection}
                onChange={(e) => handleCollectionChange(e.target.value, relatedCollection)}
                className="select-input"
              >
                {collections.map(col => (
                  <option key={col.id} value={col.id}>{col.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="related-collection">Related Collection:</label>
              <select
                id="related-collection"
                value={relatedCollection}
                onChange={(e) => handleCollectionChange(primaryCollection, e.target.value)}
                className="select-input"
              >
                {collections.filter(col => col.id !== primaryCollection).map(col => (
                  <option key={col.id} value={col.id}>{col.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="relationship-diagram">
            <div className="relationship-diagram-content">
              <div className="relationship-node primary-node">
                {collections.find(c => c.id === primaryCollection)?.name || primaryCollection}
              </div>
              <div className="relationship-arrow">↓</div>
              <div className="relationship-description">{getRelationshipDescription()}</div>
              <div className="relationship-arrow">↓</div>
              <div className="relationship-node secondary-node">
                {collections.find(c => c.id === relatedCollection)?.name || relatedCollection}
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mb-6">
          <div className="form-group">
            <label htmlFor="relationship-query">Relationship Query:</label>
            <textarea
              id="relationship-query"
              value={relationshipQuery}
              onChange={(e) => setRelationshipQuery(e.target.value)}
              placeholder={`e.g., ${generateRelationshipQuery()}`}
              className="textarea-input"
              rows={3}
            />
          </div>

          <button
            type="submit"
            className="button button-primary"
            disabled={loading || !token}
          >
            {loading ? 'Processing...' : 'Explore Relationship'}
          </button>
        </form>

        {/* Debug Information Panel */}
        {queryDebugInfo && (
          <div className="debug-panel">
            <h3 className="debug-title">
              Query Debug Information
              {queryDebugInfo.deepseekProcessed && (
                <span className="llm-badge">Processed by Deepseek LLM</span>
              )}
            </h3>
            <div className="debug-content">
              <div className="debug-section">
                <h4>Original Query</h4>
                <pre>{queryDebugInfo.originalQuery}</pre>
              </div>

              <div className="debug-section">
                <h4>Collections</h4>
                <p>Primary: <strong>{queryDebugInfo.primaryCollection}</strong></p>
                <p>Related: <strong>{queryDebugInfo.relatedCollection}</strong></p>
              </div>

              <div className="debug-section">
                <h4>Processed Query</h4>
                <pre>{JSON.stringify(queryDebugInfo.processedQuery, null, 2)}</pre>
              </div>

              <div className="debug-section">
                <h4>MongoDB Query</h4>
                <pre>{JSON.stringify(queryDebugInfo.mongoDBQuery, null, 2)}</pre>
              </div>

              <div className="debug-section">
                <h4>Explanation</h4>
                <p>{queryDebugInfo.explanation || queryDebugInfo.mongoDBQuery.explanation}</p>
              </div>

              {queryDebugInfo.message && (
                <div className="debug-section message-section">
                  <h4>Message</h4>
                  <p className="query-message">{queryDebugInfo.message}</p>
                </div>
              )}

              {queryDebugInfo.deepseekProcessed && queryDebugInfo.tokenUsage && (
                <div className="debug-section">
                  <h4>Deepseek Token Usage</h4>
                  <pre>{JSON.stringify(queryDebugInfo.tokenUsage, null, 2)}</pre>
                </div>
              )}
            </div>
          </div>
        )}

        {results.length > 0 ? (
          <div className="results-container">
            <div className="results-header">
              <h3>Results ({results.length})</h3>
              {results.length > 10 && (
                <span className="more-results">Showing 10 of {results.length} results</span>
              )}
            </div>

            <div className="results-table-container">
              <table className="results-table">
                <thead>
                  <tr>
                    {Object.keys(results[0]).map(key => (
                      <th key={key}>{key}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {results.slice(0, 10).map((result, index) => (
                    <tr key={index}>
                      {Object.values(result).map((value, i) => (
                        <td key={i}>
                          {typeof value === 'object'
                            ? JSON.stringify(value)
                            : String(value)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          !loading && <div className="no-results">
            {queryDebugInfo && queryDebugInfo.message ?
              queryDebugInfo.message :
              `No relationship data found between ${primaryCollection} and ${relatedCollection}`}
          </div>
        )}
      </div>
    </div>
  );
}

export default RelationshipExplorer;
