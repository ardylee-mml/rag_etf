import { useState } from 'react';
import axios from 'axios';

function InsightsPanel({ token }) {
  const [selectedInsight, setSelectedInsight] = useState(null);
  const [insightResults, setInsightResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const insights = [
    {
      id: 'player-journey',
      title: 'Player Journey Analysis',
      description: 'Analyze how players navigate through the game',
      query: 'Find events where type is zone and group by context.zoneId',
      collection: 'events'
    },
    {
      id: 'item-engagement',
      title: 'Item Engagement',
      description: 'Discover which items players interact with most',
      query: 'Find events where type is item and group by context.itemId',
      collection: 'events'
    },
    {
      id: 'learning-assessment',
      title: 'Learning Assessment',
      description: 'Evaluate player responses to questions',
      query: 'Find events where type is question and group by context.questionId',
      collection: 'events'
    },
    {
      id: 'player-demographics',
      title: 'Player Demographics',
      description: 'Analyze player distribution by region and language',
      query: 'Group players by region and count',
      collection: 'players'
    },
    {
      id: 'performance-metrics',
      title: 'Performance Metrics',
      description: 'Examine player scores and achievements',
      query: 'Find top scores on leaderboards grouped by playerId',
      collection: 'leaderboards'
    }
  ];

  // No mock insights data handler - we always use the real API

  const runInsightQuery = async (insight) => {
    try {
      setLoading(true);
      setError('');
      setSelectedInsight(insight);

      // Always use real API
      const response = await axios.post('/api/query', {
        query: insight.query,
        collection: insight.collection,
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
      const results = response.data.results || [];

      setInsightResults(results);
    } catch (err) {
      setError('Query failed: ' + (err.response?.data?.message || err.message));
      setInsightResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="insights-panel">
      <h2 className="text-xl font-bold mb-6">Game Analytics Insights</h2>

      {error && <div className="error">{error}</div>}

      <div className="insights-grid">
        <div className="card">
          <h3 className="card-title mb-4">Available Insights</h3>

          <div className="space-y-4">
            {insights.map(insight => (
              <div
                key={insight.id}
                className={`insight-item ${
                  selectedInsight?.id === insight.id
                    ? 'insight-item-selected'
                    : ''
                }`}
                onClick={() => runInsightQuery(insight)}
              >
                <h4 className="insight-title">{insight.title}</h4>
                <p className="insight-description">{insight.description}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h3 className="card-title mb-4">
            {selectedInsight
              ? `${selectedInsight.title} Results`
              : 'Select an insight to view results'}
          </h3>

          {loading ? (
            <div className="loading-indicator">Loading...</div>
          ) : insightResults.length > 0 ? (
            <div className="results-table-container">
              <table className="results-table">
                <thead>
                  <tr>
                    {Object.keys(insightResults[0]).map(key => (
                      <th key={key}>{key}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {insightResults.slice(0, 10).map((result, index) => (
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
              {insightResults.length > 10 && (
                <p className="more-results">Showing 10 of {insightResults.length} results</p>
              )}
            </div>
          ) : (
            <div className="insights-section">
              <h3 className="insights-section-title">Database Insights</h3>
              <p className="mb-4">The "Escape To Freedom" game database contains:</p>

              <ul className="insights-list">
                <li><strong>304,814 players</strong> from various regions with different language preferences</li>
                <li><strong>10,929,576 events</strong> recording player activities like item interactions and zone movements</li>
                <li><strong>65 zones</strong> that define key areas within the game</li>
                <li><strong>100 items</strong> that players can collect or interact with</li>
                <li><strong>56 questions</strong> presented to players during gameplay</li>
                <li><strong>141,349 leaderboard</strong> entries tracking player scores</li>
              </ul>

              <p className="mb-4">Key relationships in the database:</p>
              <ul className="insights-list">
                <li>Players generate events through their actions in the game</li>
                <li>Events record when players interact with items, enter zones, or answer questions</li>
                <li>Leaderboards track player performance across different stages</li>
                <li>Questions focus on refugee-related topics</li>
              </ul>

              <p>Select an insight from the left panel to explore specific aspects of the game data.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default InsightsPanel;
