import { useState, useEffect } from 'react';
import axios from 'axios';

// Collection field definitions
const COLLECTION_FIELDS = {
  events: [
    { name: '_id', description: 'Unique identifier for the event' },
    { name: 'playerId', description: 'ID of the player who triggered the event' },
    { name: 'type', description: 'Type of event (signin, signout, item, zone, question, etc.)' },
    { name: 'time', description: 'Timestamp when the event occurred' },
    { name: 'context.itemId', description: 'ID of the item being interacted with (for item events)' },
    { name: 'context.zoneId', description: 'ID of the zone being visited (for zone events)' },
    { name: 'context.questionId', description: 'ID of the question being answered (for question events)' },
    { name: 'context.choiceId', description: 'ID of the selected answer choice (for question events)' },
    { name: 'timeTaken', description: 'Time taken to complete the action (for applicable events)' },
    { name: 'correct', description: 'Whether the answer was correct (for question events)' }
  ],
  players: [
    { name: '_id', description: 'Unique identifier for the player' },
    { name: 'playerId', description: 'Player ID used for relationships with other collections' },
    { name: 'name', description: 'Player name' },
    { name: 'email', description: 'Player email address' },
    { name: 'region', description: 'Geographic region of the player' },
    { name: 'createdAt', description: 'When the player account was created' },
    { name: 'lastLogin', description: 'When the player last logged in' }
  ],
  items: [
    { name: '_id', description: 'Unique identifier for the item' },
    { name: 'name', description: 'Item name' },
    { name: 'description', description: 'Item description' },
    { name: 'type', description: 'Type of item' },
    { name: 'location', description: 'Where the item is located' },
    { name: 'value', description: 'Value or importance of the item' }
  ],
  zones: [
    { name: '_id', description: 'Unique identifier for the zone' },
    { name: 'name', description: 'Zone name' },
    { name: 'description', description: 'Zone description' },
    { name: 'type', description: 'Type of zone' },
    { name: 'region', description: 'Region where the zone is located' }
  ],
  questions: [
    { name: '_id', description: 'Unique identifier for the question' },
    { name: 'text', description: 'Question text' },
    { name: 'choices', description: 'Array of possible answers' },
    { name: 'difficulty', description: 'Question difficulty level' },
    { name: 'category', description: 'Question category' },
    { name: 'userId', description: 'ID of the user who created the question' }
  ],
  leaderboards: [
    { name: '_id', description: 'Unique identifier for the leaderboard entry' },
    { name: 'playerId', description: 'ID of the player' },
    { name: 'score', description: 'Player score' },
    { name: 'level', description: 'Player level' },
    { name: 'timestamp', description: 'When the score was recorded' }
  ]
};

// Event types with descriptions
const EVENT_TYPES = [
  { type: 'signin', description: 'Player logged into the game' },
  { type: 'signout', description: 'Player logged out of the game' },
  { type: 'item', description: 'Player interacted with an item' },
  { type: 'zone', description: 'Player entered a zone' },
  { type: 'question', description: 'Player answered a question' },
  { type: 'chat', description: 'Player sent a chat message' },
  { type: 'gameover', description: 'Player finished a game session' },
  { type: 'register', description: 'Player registered a new account' }
];

function QueryInterface({ token, collections }) {
  console.log('QueryInterface rendered with token:', token);
  const [query, setQuery] = useState('');
  const [collection, setCollection] = useState('events');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [queryDebugInfo, setQueryDebugInfo] = useState(null);

  // Progress bar state
  const [progress, setProgress] = useState(0);
  const [progressStage, setProgressStage] = useState('');

  // Minimizable sections state
  const [fieldsMinimized, setFieldsMinimized] = useState(false);
  const [eventTypesMinimized, setEventTypesMinimized] = useState(false);

  // Reset progress when loading state changes
  useEffect(() => {
    if (loading) {
      setProgress(10);
      setProgressStage('Initializing query...');

      // Simulate progress updates for better UX
      const progressIntervals = [
        { progress: 25, stage: 'Analyzing query...', delay: 500 },
        { progress: 40, stage: 'Generating MongoDB pipeline...', delay: 1000 },
        { progress: 60, stage: 'Executing query...', delay: 1500 },
        { progress: 80, stage: 'Processing results...', delay: 2000 }
      ];

      // Set up the progress intervals
      const timers = progressIntervals.map(({ progress, stage, delay }) => {
        return setTimeout(() => {
          setProgress(progress);
          setProgressStage(stage);
        }, delay);
      });

      // Clean up timers
      return () => {
        timers.forEach(timer => clearTimeout(timer));
      };
    } else {
      setProgress(0);
      setProgressStage('');
    }
  }, [loading]);

  // Real API query handler
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!query.trim()) {
      setError('Please enter a query');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setQueryDebugInfo(null);

      console.log('Submitting query:', query);
      console.log('Collection:', collection);

      // Use the real API endpoint on port 3000
      const apiUrl = '/api/query';
      console.log('Sending request to:', apiUrl);

      // Update progress
      setProgress(30);
      setProgressStage('Sending query to server...');

      const apiResponse = await axios.post(apiUrl, {
        query,
        collection,
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
          'Authorization': `Bearer ${token || 'dummy-token'}`
        }
      });

      // Update progress
      setProgress(90);
      setProgressStage('Processing response...');

      const response = apiResponse.data;
      console.log('API Response received:', response);
      console.log('Results count:', response.results ? response.results.length : 0);

      // Create debug info for API calls
      setQueryDebugInfo({
        originalQuery: query,
        collection: collection,
        deepseekProcessed: true,
        processedQuery: response.processedQuery || `db.${collection}.find()`,
        mongoDBQuery: {
          pipeline: response.pipeline || [],
          explanation: response.explanation || 'MongoDB aggregation pipeline'
        },
        message: response.message,
        tokenUsage: response.tokenUsage
      });

      // Check if we have results and log them
      if (response.results && response.results.length > 0) {
        console.log('First result:', response.results[0]);
      } else {
        console.log('No results returned from API');
      }

      // Complete progress
      setProgress(100);
      setProgressStage('Query completed successfully!');

      // Short delay before showing results
      setTimeout(() => {
        setResults(response.results || []);
        setLoading(false);
      }, 500);
    } catch (err) {
      console.error('Query error:', err);
      setError('Query failed: ' + (err.response?.data?.message || err.message));
      setResults([]);
      setQueryDebugInfo(null);
      setLoading(false);
    }
  };

  // Handle field click to add to query
  const handleFieldClick = (fieldName) => {
    const fieldText = `${fieldName}`;
    setQuery(prev => {
      if (prev.trim() === '') {
        return `Find ${collection} where ${fieldText} is `;
      } else {
        return `${prev} ${fieldText}`;
      }
    });
  };

  // Handle event type click to add to query
  const handleEventTypeClick = (eventType) => {
    setQuery(prev => {
      if (prev.trim() === '') {
        return `Find events where type is "${eventType}"`;
      } else {
        return `${prev} type is "${eventType}"`;
      }
    });
  };

  return (
    <div className="query-interface">
      <div className="query-form">
        {error && <div className="error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="collection">Collection:</label>
            <select
              id="collection"
              value={collection}
              onChange={(e) => setCollection(e.target.value)}
              className="select-input"
              disabled={loading}
            >
              {collections.map(col => (
                <option key={col.id} value={col.id}>{col.name}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="query">Natural Language Query:</label>
            <textarea
              id="query"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`e.g., Find ${collection} where type is "zone" and context.zoneId contains "S1-R1-LivRm"`}
              className="textarea-input"
              rows={3}
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            className="button button-primary"
            disabled={loading}
          >
            {loading ? 'Processing...' : 'Submit Query'}
          </button>
        </form>

        {/* Progress Bar */}
        {loading && (
          <div className="progress-container">
            <div className="progress-bar-wrapper">
              <div
                className="progress-bar"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <div className="progress-stage">{progressStage}</div>
            <div className="progress-percentage">{progress}%</div>
          </div>
        )}

        {/* Collection Fields and Event Types */}
        {!loading && (
          <div className="collection-info">
            <div className="fields-container">
              <div
                className="section-header"
                onClick={() => setFieldsMinimized(!fieldsMinimized)}
              >
                <h3 className="fields-title">Available Fields for {collection}:</h3>
                <span className={`toggle-icon ${fieldsMinimized ? 'icon-down' : 'icon-up'}`}>
                  {fieldsMinimized ? '▼' : '▲'}
                </span>
              </div>
              {!fieldsMinimized && (
                <div className="fields-list">
                  {COLLECTION_FIELDS[collection] ? (
                    COLLECTION_FIELDS[collection].map((field, index) => (
                      <div key={index} className="field-item" onClick={() => handleFieldClick(field.name)}>
                        <span className="field-name">{field.name}</span>
                        <span className="field-description">{field.description}</span>
                      </div>
                    ))
                  ) : (
                    <p>No field information available for this collection.</p>
                  )}
                </div>
              )}
            </div>

            {collection === 'events' && (
              <div className="event-types-container">
                <div
                  className="section-header"
                  onClick={() => setEventTypesMinimized(!eventTypesMinimized)}
                >
                  <h3 className="event-types-title">Event Types:</h3>
                  <span className={`toggle-icon ${eventTypesMinimized ? 'icon-down' : 'icon-up'}`}>
                    {eventTypesMinimized ? '▼' : '▲'}
                  </span>
                </div>
                {!eventTypesMinimized && (
                  <div className="event-types-list">
                    {EVENT_TYPES.map((eventType, index) => (
                      <div key={index} className="event-type-item" onClick={() => handleEventTypeClick(eventType.type)}>
                        <span className="event-type-name">{eventType.type}</span>
                        <span className="event-type-description">{eventType.description}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Debug Information Panel */}
        {queryDebugInfo && (
          <div className="debug-panel">
            <h3 className="debug-title">
              Query Debug Information
              <span className="llm-badge">Processed by Deepseek LLM</span>
            </h3>
            <div className="debug-content">
              <div className="debug-section">
                <h4>Original Query</h4>
                <pre>{queryDebugInfo.originalQuery}</pre>
              </div>

              <div className="debug-section">
                <h4>Collection</h4>
                <p><strong>{queryDebugInfo.collection}</strong></p>
              </div>

              <div className="debug-section">
                <h4>Processed Query</h4>
                <pre>{typeof queryDebugInfo.processedQuery === 'object'
                  ? JSON.stringify(queryDebugInfo.processedQuery, null, 2)
                  : queryDebugInfo.processedQuery}</pre>
              </div>

              <div className="debug-section">
                <h4>MongoDB Query</h4>
                <pre>{JSON.stringify(queryDebugInfo.mongoDBQuery, null, 2)}</pre>
              </div>

              <div className="debug-section">
                <h4>Explanation</h4>
                <p>{queryDebugInfo.mongoDBQuery.explanation}</p>
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
      </div>

      {!loading && results.length > 0 && (
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
      )}
    </div>
  );
}

export default QueryInterface;
